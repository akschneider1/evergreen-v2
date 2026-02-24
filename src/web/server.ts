/**
 * Evergreen Web App — Express server
 *
 * Routes:
 *   GET  /                    — USWDS input form
 *   POST /api/run             — Start an eval job, returns { jobId }
 *   GET  /api/status/:jobId   — Poll job progress { step, status, error? }
 *   GET  /report/:jobId       — Serve completed report HTML
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import { fetchSheet, extractSheetId } from '../sheets';
import { buildPromptfooConfig, writePromptfooConfig } from '../config';
import { runPromptfooAsync } from '../runner';
import { mapToEvalResults } from '../mapper';
import { generateReport } from '../report/generator';
import { normalizePromptfooOutput, EvergreenConfig, SheetRow } from '../types';
import { getPreset } from '../presets/index';

// ── Job state ────────────────────────────────────────────────────────────────

interface Job {
  step: number;           // 0 = not started, 1–4 = pipeline steps
  status: 'running' | 'complete' | 'error';
  error?: string;
  reportHtml?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONCURRENT_JOBS = 3;

// ── Rate limiting ──

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10;              // requests per window per IP

const rateCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateCounts.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/** Remove completed/errored jobs older than JOB_TTL_MS to prevent memory leaks. */
function pruneStaleJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.status !== 'running' && now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

function countRunningJobs(): number {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === 'running') count++;
  }
  return count;
}

function newJobId(): string {
  return crypto.randomBytes(8).toString('hex');
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

async function runPipeline(
  jobId: string,
  body: { description: string; sheetUrl?: string; provider: string; aiDescription?: string; presetId?: string },
): Promise<void> {
  const job = jobs.get(jobId)!;

  try {
    // Step 1 — Load test cases (from preset or Google Sheet)
    job.step = 1;
    let rows: SheetRow[];
    let systemPrompt: string | undefined;
    let testSource: string;
    let sheetId: string;

    if (body.presetId) {
      const preset = getPreset(body.presetId);
      if (!preset) throw new Error(`The selected test suite could not be found. Try selecting a different suite.`);
      rows = preset.rows;
      systemPrompt = preset.systemPrompt;
      testSource = `Built-in: ${preset.name}`;
      sheetId = '';
    } else {
      sheetId = extractSheetId(body.sheetUrl!);
      rows = await fetchSheet(sheetId);
      systemPrompt = body.aiDescription
        ? `You are a helpful AI assistant. ${body.aiDescription} Be accurate, clear, and easy to understand.`
        : undefined;
      testSource = 'Google Sheets';
    }

    // Step 2 — Build Promptfoo config
    job.step = 2;
    const config: EvergreenConfig = {
      description: body.description || 'Evergreen Evaluation',
      sheetId,
      sheetRange: 'A2:E',
      providers: [{ id: body.provider, systemPrompt }],
      defaultSystemPrompt: systemPrompt,
      outputPath: path.join(os.tmpdir(), `evergreen-results-${jobId}.json`),
    };
    const pfConfig = buildPromptfooConfig(rows, config);
    const pfConfigPath = path.join(os.tmpdir(), `evergreen-config-${jobId}.yaml`);
    writePromptfooConfig(pfConfig, pfConfigPath);

    // Step 3 — Run evaluations (async, non-blocking)
    job.step = 3;
    const pfRaw = await runPromptfooAsync(pfConfigPath, config.outputPath!);
    const pfOutput = normalizePromptfooOutput(pfRaw);

    // Check if all responses are empty — indicates an API key or provider issue
    const allEmpty = pfOutput.results.every(
      r => !r.response?.output || r.response.output === '(no response)',
    );
    if (allEmpty && pfOutput.results.length > 0) {
      throw new Error(
        `The evaluation ran, but the AI provider returned no responses for any test case. ` +
        `This usually means:\n` +
        `  • The API key is missing or invalid — check that the correct key is set (e.g., ANTHROPIC_API_KEY or OPENAI_API_KEY)\n` +
        `  • The selected provider is incorrect — make sure the dropdown matches your API key\n` +
        `  • The AI provider is unreachable — check your network connection\n` +
        `Set the API key in your environment and try again.`
      );
    }

    // Step 4 — Generate report
    job.step = 4;
    const evalResults = mapToEvalResults(pfOutput, rows, config.description, testSource, systemPrompt);
    job.reportHtml = generateReport(evalResults);
    job.status = 'complete';

    // Cleanup temp files
    try { fs.unlinkSync(pfConfigPath); } catch { /* ignore */ }
    try { fs.unlinkSync(config.outputPath!); } catch { /* ignore */ }

  } catch (err) {
    job.status = 'error';
    job.error = err instanceof Error ? err.message : String(err);
  }
}

// ── Express app ───────────────────────────────────────────────────────────────

export function createApp(): express.Application {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Content-Security-Policy — allow self + inline styles (USWDS) + blob: (downloads)
  app.use((_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  // USWDS static assets (self-hosted to avoid CDN dependency)
  app.use('/assets', express.static(path.join(__dirname, '..', 'assets'), {
    maxAge: '1d',
    immutable: true,
  }));

  // Input form
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'input.html'));
  });

  // Start eval job
  app.post('/api/run', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      res.status(429).json({ error: 'Too many requests. Please wait a minute before trying again.' });
      return;
    }

    const body = req.body;

    // Validate that required fields are present and are strings
    const sheetUrl = typeof body?.sheetUrl === 'string' ? body.sheetUrl.trim() : '';
    const presetId = typeof body?.presetId === 'string' ? body.presetId.trim() : '';
    const provider = typeof body?.provider === 'string' ? body.provider.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const aiDescription = typeof body?.aiDescription === 'string' ? body.aiDescription.trim() : '';

    // Input length bounds
    if (description.length > 200) {
      res.status(400).json({ error: 'Evaluation name is too long (200 characters max).' });
      return;
    }
    if (aiDescription.length > 500) {
      res.status(400).json({ error: 'AI description is too long (500 characters max).' });
      return;
    }
    if (sheetUrl.length > 500) {
      res.status(400).json({ error: 'Sheet URL is too long. Copy the URL directly from your browser.' });
      return;
    }

    if (!presetId && !sheetUrl) {
      res.status(400).json({ error: 'Please provide a Google Sheet URL or select a built-in test suite.' });
      return;
    }
    if (!provider) {
      res.status(400).json({ error: 'Please select an LLM provider.' });
      return;
    }

    pruneStaleJobs();

    if (countRunningJobs() >= MAX_CONCURRENT_JOBS) {
      res.status(429).json({
        error: `The server is busy — ${MAX_CONCURRENT_JOBS} evaluations are already running. Please wait a minute and try again.`,
      });
      return;
    }

    const jobId = newJobId();
    jobs.set(jobId, { step: 0, status: 'running', createdAt: Date.now() });

    // Fire-and-forget — response returns immediately with jobId
    runPipeline(jobId, { description, sheetUrl, presetId, provider, aiDescription });

    res.status(202).json({ jobId });
  });

  // Poll job status
  app.get('/api/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ step: job.step, status: job.status, error: job.error });
  });

  // Serve completed report
  app.get('/report/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job || job.status !== 'complete' || !job.reportHtml) {
      res.status(404).send('<p>Report not found or not ready yet.</p>');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(job.reportHtml);
  });

  return app;
}

export function startApp(port: number): void {
  const app = createApp();
  const host = '0.0.0.0';
  const server = app.listen(port, host, () => {
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  Evergreen — Web App                    │');
    console.log('└─────────────────────────────────────────┘');
    console.log('');
    console.log(`  URL:  http://localhost:${port}`);
    console.log('');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
  });

  // Graceful shutdown — clean up temp files for any running jobs
  function shutdown(): void {
    console.log('\nShutting down…');
    for (const [id, job] of jobs) {
      if (job.status === 'running') {
        job.status = 'error';
        job.error = 'Server shut down while evaluation was running.';
      }
    }
    jobs.clear();
    rateCounts.clear();
    server.close(() => process.exit(0));
    // Force exit after 5s if connections are still open
    setTimeout(() => process.exit(0), 5000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
