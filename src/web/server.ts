/**
 * Evergreen Web App — Express server
 *
 * Routes:
 *   GET  /                    — Landing page
 *   GET  /builder             — Test suite builder
 *   GET  /run                 — Eval runner form (was /)
 *   GET  /api/templates       — List all template presets
 *   GET  /api/templates/:id   — Get a single template with builder cases
 *   POST /api/export-sheet    — Export builder cases as CSV
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
import { normalizePromptfooOutput, EvergreenConfig, SheetRow, PresetPersona } from '../types';
import { getPreset, getAllPresets } from '../presets/index';
import { getBuilderCases, builderCasesToCsv, metricDistribution } from '../builder';
import { isLangfuseConfigured, makeLangfuseClient, getTraceUrl, getLangfuseBaseUrl } from '../langfuse';

// ── Job state ────────────────────────────────────────────────────────────────

interface Job {
  step: number;           // 0 = not started, 1–4 = pipeline steps
  status: 'running' | 'complete' | 'error';
  error?: string;
  reportHtml?: string;
  createdAt: number;
  traceUrl?: string;
  generationIds?: string[];  // index = testNumber - 1, populated when Langfuse tracing is on
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
  body: {
    description: string; sheetUrl?: string; provider: string; aiDescription?: string; presetId?: string;
    agencyName?: string; evaluatorName?: string; evaluationReason?: string; enableLangfuse?: boolean;
  },
): Promise<void> {
  const job = jobs.get(jobId)!;

  const useLangfuse = body.enableLangfuse && isLangfuseConfigured();
  const lf = useLangfuse ? makeLangfuseClient() : null;
  const trace = lf ? lf.trace({
    id: jobId,
    name: body.description || 'Evergreen Evaluation',
    metadata: {
      provider: body.provider,
      agencyName: body.agencyName,
      evaluatorName: body.evaluatorName,
      evaluationReason: body.evaluationReason,
      testSource: body.presetId ? `preset:${body.presetId}` : 'google-sheet',
    },
  }) : null;

  try {
    // Step 1 — Load test cases (from preset or Google Sheet)
    job.step = 1;
    let rows: SheetRow[];
    let systemPrompt: string | undefined;
    let testSource: string;
    let sheetId: string;
    let personas: PresetPersona[] | undefined;

    const s1 = trace?.span({ name: 'load-test-cases', input: { source: body.presetId ?? body.sheetUrl } });
    if (body.presetId) {
      const preset = getPreset(body.presetId);
      if (!preset) throw new Error(`The selected test suite could not be found. Try selecting a different suite.`);
      rows = preset.rows;
      systemPrompt = preset.systemPrompt;
      testSource = `Built-in: ${preset.name}`;
      sheetId = '';
      personas = preset.personas;
    } else {
      sheetId = extractSheetId(body.sheetUrl!);
      rows = await fetchSheet(sheetId);
      systemPrompt = body.aiDescription
        ? `You are a helpful AI assistant. ${body.aiDescription} Be accurate, clear, and easy to understand.`
        : undefined;
      testSource = 'Google Sheets';
    }
    s1?.end({ output: { rowCount: rows.length } });

    // Add persona tags to trace if this preset uses personas
    if (trace && personas) {
      const personaTags = [...new Set(rows.map(r => r.persona).filter(Boolean))] as string[];
      if (personaTags.length > 0) {
        trace.update({ tags: personaTags });
      }
    }

    // Step 2 — Build Promptfoo config
    job.step = 2;
    const s2 = trace?.span({ name: 'build-config', input: { rowCount: rows.length, provider: body.provider } });
    const config: EvergreenConfig = {
      description: body.description || 'Evergreen Evaluation',
      sheetId,
      sheetRange: 'A2:E',
      providers: [{ id: body.provider, systemPrompt }],
      defaultSystemPrompt: systemPrompt,
      outputPath: path.join(os.tmpdir(), `evergreen-results-${jobId}.json`),
    };
    const pfConfig = buildPromptfooConfig(rows, config, personas);
    const pfConfigPath = path.join(os.tmpdir(), `evergreen-config-${jobId}.yaml`);
    writePromptfooConfig(pfConfig, pfConfigPath);
    s2?.end({ output: { testCount: rows.length } });

    // Step 3 — Run evaluations (async, non-blocking)
    job.step = 3;
    const s3 = trace?.span({ name: 'run-eval', input: { provider: body.provider, testCount: rows.length } });
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
    const passCount = pfOutput.results.filter(r => r.success).length;

    // Log one observation per test case — capture IDs so user-feedback scores can attach later
    if (s3) {
      const generationIds: string[] = [];
      pfOutput.results.forEach((r, i) => {
        const metric   = rows[i]?.metric   ?? '';
        const severity = rows[i]?.severity ?? '';
        const persona  = rows[i]?.persona  ?? '';

        // Detect multi-turn: prompt.raw is a JSON messages array
        let parsedTurns: { role: string; content: string }[] = [];
        try {
          const parsed = JSON.parse(r.prompt?.raw ?? '');
          if (Array.isArray(parsed)) parsedTurns = parsed;
        } catch { /* single-turn: prompt.raw is a plain string */ }

        if (parsedTurns.length > 0) {
          // Multi-turn: span with nested generation per user→assistant exchange
          const convSpan = s3.span({
            name: `test-${i + 1}`,
            metadata: { metric, severity, persona },
          });
          let turnNum = 1;
          for (let t = 0; t < parsedTurns.length; t++) {
            if (parsedTurns[t].role !== 'user') continue;
            const isLiveTurn = t === parsedTurns.length - 1;
            const output = isLiveTurn
              ? (r.response?.output ?? '')
              : (parsedTurns[t + 1]?.content ?? '');
            convSpan.generation({
              name:   `turn-${turnNum++}`,
              model:  r.provider?.id ?? body.provider,
              input:  parsedTurns[t].content,
              output,
              metadata: { seeded: String(!isLiveTurn), ...(isLiveTurn ? { gradingReason: r.gradingResult?.reason ?? '' } : {}) },
            });
          }
          convSpan.score({ name: 'pass-fail', value: r.success ? 1 : 0, dataType: 'BOOLEAN'     });
          convSpan.score({ name: 'metric',    value: metric,              dataType: 'CATEGORICAL' });
          convSpan.score({ name: 'severity',  value: severity,            dataType: 'CATEGORICAL' });
          if (persona) convSpan.score({ name: 'persona', value: persona,  dataType: 'CATEGORICAL' });
          convSpan.end({ output: { passed: r.success, gradingReason: r.gradingResult?.reason ?? '' } });
          generationIds.push(convSpan.id);
        } else {
          // Single-turn: plain generation
          const gen = s3.generation({
            name:   `test-${i + 1}`,
            model:  r.provider?.id ?? body.provider,
            input:  r.prompt?.raw ?? '',
            output: r.response?.output ?? '',
            metadata: { metric, severity, gradingReason: r.gradingResult?.reason ?? '', ...(persona ? { persona } : {}) },
          });
          gen.score({ name: 'pass-fail',  value: r.success ? 1 : 0, dataType: 'BOOLEAN'     });
          gen.score({ name: 'metric',     value: metric,              dataType: 'CATEGORICAL' });
          gen.score({ name: 'severity',   value: severity,            dataType: 'CATEGORICAL' });
          if (persona) gen.score({ name: 'persona', value: persona,   dataType: 'CATEGORICAL' });
          generationIds.push(gen.id);
        }
      });
      job.generationIds = generationIds;
    }

    s3?.end({ output: { passed: passCount, total: pfOutput.results.length } });

    // Step 4 — Generate report
    job.step = 4;
    const s4 = trace?.span({ name: 'generate-report' });
    const evalResults = mapToEvalResults(pfOutput, rows, config.description, testSource, systemPrompt);
    evalResults.agencyName = body.agencyName;
    evalResults.evaluatorName = body.evaluatorName;
    evalResults.evaluationReason = body.evaluationReason;
    evalResults.presetId = body.presetId;
    job.reportHtml = generateReport(evalResults, job.generationIds ? jobId : undefined);
    const totalTests = evalResults.testCases.length;
    const passedTests = evalResults.testCases.filter(tc => tc.results.every(r => r.passed)).length;
    s4?.end({ output: { passedTests, totalTests } });

    if (trace) {
      job.traceUrl = getTraceUrl(jobId);
    }
    job.status = 'complete';

    // Cleanup temp files
    try { fs.unlinkSync(pfConfigPath); } catch { /* ignore */ }
    try { fs.unlinkSync(config.outputPath!); } catch { /* ignore */ }

  } catch (err) {
    trace?.update({ metadata: { error: String(err) } });
    job.status = 'error';
    job.error = err instanceof Error ? err.message : String(err);
  } finally {
    await lf?.flushAsync();
  }
}

// ── Cost estimation ───────────────────────────────────────────────────────────

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  let pPer1k = 0.002, cPer1k = 0.008;
  if (model.includes('gpt-4o'))              { pPer1k = 0.0025;  cPer1k = 0.010; }
  else if (model.includes('gpt-4'))          { pPer1k = 0.030;   cPer1k = 0.060; }
  else if (model.includes('gpt-3.5'))        { pPer1k = 0.0005;  cPer1k = 0.0015; }
  else if (model.includes('claude-haiku'))   { pPer1k = 0.00025; cPer1k = 0.00125; }
  else if (model.includes('claude-opus'))    { pPer1k = 0.015;   cPer1k = 0.075; }
  else if (model.includes('claude-sonnet') || model.includes('claude-3-5')) { pPer1k = 0.003; cPer1k = 0.015; }
  return (promptTokens / 1000) * pPer1k + (completionTokens / 1000) * cPer1k;
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

  // Capabilities — lets the client know which optional features are available
  app.get('/api/capabilities', (_req, res) => {
    res.json({ langfuseEnabled: isLangfuseConfigured() });
  });

  // Landing page
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'landing.html'));
  });

  // Test suite builder
  app.get('/builder', (_req, res) => {
    res.sendFile(path.join(__dirname, 'builder.html'));
  });

  // Eval runner form (was /)
  app.get('/run', (_req, res) => {
    res.sendFile(path.join(__dirname, 'input.html'));
  });

  // ── Template API ──

  // List all templates (summaries for sidebar/landing)
  app.get('/api/templates', (_req, res) => {
    const presets = getAllPresets()
      .filter(p => !p.id.startsWith('demo-'))
      .map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon || '',
        domain: p.domain || '',
        caseCount: p.rows.length,
        description: p.description,
        metricDistribution: metricDistribution(getBuilderCases(p)),
      }));
    res.json(presets);
  });

  // Get a single template with full builder cases
  app.get('/api/templates/:id', (req, res) => {
    const preset = getPreset(req.params.id);
    if (!preset) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({
      id: preset.id,
      name: preset.name,
      icon: preset.icon || '',
      domain: preset.domain || '',
      description: preset.description,
      source: preset.source || '',
      sourceUrl: preset.sourceUrl || '',
      systemPrompt: preset.systemPrompt,
      builderCases: getBuilderCases(preset),
    });
  });

  // Export builder cases as CSV
  app.post('/api/export-sheet', (req, res) => {
    const cases = req.body?.cases;
    if (!Array.isArray(cases) || cases.length === 0) {
      res.status(400).json({ error: 'No test cases to export.' });
      return;
    }
    const csv = builderCasesToCsv(cases);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="evergreen-test-cases.csv"');
    res.send(csv);
  });

  // User feedback — attach a score to a specific generation in Langfuse
  app.post('/api/feedback', async (req, res) => {
    const { jobId, testNumber, value } = req.body ?? {};
    if (typeof jobId !== 'string' || typeof testNumber !== 'number' || (value !== 1 && value !== 0)) {
      res.status(400).json({ error: 'Invalid request.' });
      return;
    }
    const job = jobs.get(jobId);
    const observationId = job?.generationIds?.[testNumber - 1];
    if (!observationId || !isLangfuseConfigured()) {
      res.status(404).json({ error: 'Feedback not available for this report.' });
      return;
    }
    const lf = makeLangfuseClient();
    lf.score({ traceId: jobId, observationId, name: 'user-feedback', value, dataType: 'BOOLEAN' });
    await lf.flushAsync();
    res.json({ ok: true });
  });

  // Langfuse engineering data — latency, tokens, cost per test
  app.get('/api/langfuse-data/:jobId', async (req, res) => {
    if (!isLangfuseConfigured()) {
      res.status(404).json({ error: 'Langfuse is not configured on this server.' });
      return;
    }
    const job = jobs.get(req.params.jobId);
    if (!job || job.status !== 'complete') {
      res.status(404).json({ error: 'Job not found or not complete.' });
      return;
    }

    const baseUrl = getLangfuseBaseUrl();
    const pubKey = process.env.LANGFUSE_PUBLIC_KEY!;
    const secKey = process.env.LANGFUSE_SECRET_KEY!;
    const auth = Buffer.from(`${pubKey}:${secKey}`).toString('base64');

    try {
      const r = await fetch(`${baseUrl}/api/public/traces/${req.params.jobId}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!r.ok) throw new Error(`Langfuse returned ${r.status}`);
      const trace = await r.json() as any;

      const observations: any[] = trace.observations ?? [];
      const genIds: string[] = job.generationIds ?? [];

      const idToTestNum = new Map<string, number>();
      genIds.forEach((id, i) => idToTestNum.set(id, i + 1));

      const tests = observations
        .filter((o: any) => idToTestNum.has(o.id))
        .map((o: any) => {
          const passScore = (o.scores ?? []).find((s: any) => s.name === 'pass-fail');
          return {
            testNumber: idToTestNum.get(o.id)!,
            latencyMs: Math.round(o.latencyMs ?? 0),
            promptTokens: o.usage?.promptTokens ?? 0,
            completionTokens: o.usage?.completionTokens ?? 0,
            passed: passScore?.value === 1,
            metric: o.metadata?.metric ?? '',
            severity: o.metadata?.severity ?? '',
          };
        })
        .sort((a: any, b: any) => a.testNumber - b.testNumber);

      const totalTests = tests.length;
      const avgLatencyMs = totalTests > 0
        ? Math.round(tests.reduce((s: number, t: any) => s + t.latencyMs, 0) / totalTests)
        : 0;
      const totalPromptTokens = tests.reduce((s: number, t: any) => s + t.promptTokens, 0);
      const totalCompletionTokens = tests.reduce((s: number, t: any) => s + t.completionTokens, 0);
      const model = observations.find((o: any) => o.model)?.model ?? 'unknown';

      res.json({
        traceUrl: getTraceUrl(req.params.jobId),
        model,
        totalTests,
        avgLatencyMs,
        totalPromptTokens,
        totalCompletionTokens,
        estimatedCostUsd: estimateCost(model, totalPromptTokens, totalCompletionTokens),
        tests,
      });
    } catch {
      res.status(502).json({ error: 'Could not fetch Langfuse data.' });
    }
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

    // Optional eval context fields
    const agencyName = typeof body?.agencyName === 'string' ? body.agencyName.trim().slice(0, 200) : undefined;
    const evaluatorName = typeof body?.evaluatorName === 'string' ? body.evaluatorName.trim().slice(0, 200) : undefined;
    const evaluationReason = typeof body?.evaluationReason === 'string' ? body.evaluationReason.trim().slice(0, 200) : undefined;

    const enableLangfuse = body?.enableLangfuse === true;

    // Fire-and-forget — response returns immediately with jobId
    runPipeline(jobId, { description, sheetUrl, presetId, provider, aiDescription, agencyName, evaluatorName, evaluationReason, enableLangfuse });

    res.status(202).json({ jobId });
  });

  // Poll job status
  app.get('/api/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ step: job.step, status: job.status, error: job.error, traceUrl: job.traceUrl });
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

  // Catch-all error handler — ensures unhandled errors return JSON, not plain text
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as any).status || 500;
    res.status(status).json({ error: err.message || 'An unexpected error occurred.' });
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
