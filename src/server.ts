/**
 * Evergreen web server.
 *
 * Serves a USWDS-styled setup page and exposes API endpoints
 * so a policy SME can run evaluations from the browser.
 *
 * Usage: npx evergreen serve [-p 3000]
 */

import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fetchSheet } from './sheets';
import { buildPromptfooConfig, writePromptfooConfig } from './config';
import { runPromptfooAsync } from './runner';
import { mapToEvalResults } from './mapper';
import { generateReport } from './report/generator';
import { generateSetupPage } from './ui';
import { EvergreenConfig, SheetRow } from './types';

// ── In-memory eval state ──

interface EvalState {
  status: 'idle' | 'running' | 'done' | 'error';
  step: string;
  message: string;
  error?: string;
}

let evalState: EvalState = {
  status: 'idle',
  step: '',
  message: '',
};

const REPORT_PATH = path.resolve('report.html');
const PF_CONFIG_PATH = path.resolve('.promptfoo-config.yaml');
const PF_OUTPUT_PATH = path.resolve('results.json');

// ── Pipeline ──

function extractSheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Could not extract Sheet ID from URL. Make sure it looks like: https://docs.google.com/spreadsheets/d/YOUR_ID/edit');
  }
  return match[1];
}

async function runPipeline(
  sheetUrl: string,
  provider: string,
  systemPrompt: string,
  description: string,
): Promise<void> {
  // Step 1: Fetch sheet
  evalState = { status: 'running', step: 'fetch', message: 'Fetching test cases from Google Sheet...' };
  const sheetId = extractSheetId(sheetUrl);
  const rows: SheetRow[] = await fetchSheet(sheetId);

  // Step 2: Generate config
  evalState = { status: 'running', step: 'config', message: `Found ${rows.length} test cases. Generating config...` };

  const config: EvergreenConfig = {
    description,
    sheetId,
    sheetRange: 'A2:E',
    providers: [{ id: provider, systemPrompt }],
    outputPath: PF_OUTPUT_PATH,
  };

  const pfConfig = buildPromptfooConfig(rows, config);
  writePromptfooConfig(pfConfig, PF_CONFIG_PATH);

  // Step 3: Run eval
  evalState = { status: 'running', step: 'eval', message: 'Running evaluations — this may take 1-2 minutes...' };
  const pfOutput = await runPromptfooAsync(PF_CONFIG_PATH, PF_OUTPUT_PATH);

  // Step 4: Generate report
  evalState = { status: 'running', step: 'report', message: 'Generating report...' };
  const evalResults = mapToEvalResults(pfOutput, rows, description);
  const html = generateReport(evalResults);
  fs.writeFileSync(REPORT_PATH, html, 'utf-8');

  // Cleanup
  try { fs.unlinkSync(PF_CONFIG_PATH); } catch { /* ignore */ }

  evalState = { status: 'done', step: 'done', message: `Report ready! ${pfOutput.stats.successes} passed, ${pfOutput.stats.failures} failed.` };
}

// ── Express app ──

export function startServer(port: number): void {
  const app = express();
  app.use(express.json());

  // Serve setup page
  app.get('/', (_req, res) => {
    res.type('html').send(generateSetupPage());
  });

  // Trigger eval
  app.post('/api/run', (req, res) => {
    if (evalState.status === 'running') {
      res.status(409).json({ error: 'An evaluation is already running. Wait for it to finish.' });
      return;
    }

    const { sheetUrl, provider, systemPrompt, description } = req.body;

    if (!sheetUrl) {
      res.status(400).json({ error: 'Missing sheetUrl' });
      return;
    }

    // Fire and forget — status is tracked via polling
    runPipeline(
      sheetUrl,
      provider || 'openai:gpt-4o',
      systemPrompt || 'You are a helpful assistant.',
      description || 'Evergreen Evaluation',
    ).catch(err => {
      evalState = {
        status: 'error',
        step: evalState.step,
        message: '',
        error: err.message || String(err),
      };
    });

    res.json({ ok: true });
  });

  // Poll status
  app.get('/api/status', (_req, res) => {
    res.json(evalState);
  });

  // Serve generated report
  app.get('/report', (_req, res) => {
    if (!fs.existsSync(REPORT_PATH)) {
      res.status(404).send('No report generated yet. Run an evaluation first.');
      return;
    }
    res.sendFile(REPORT_PATH);
  });

  app.listen(port, () => {
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  Evergreen — Web UI                     │');
    console.log('└─────────────────────────────────────────┘');
    console.log('');
    console.log(`  Open in your browser: http://localhost:${port}`);
    console.log('');
    console.log('  The policy SME can now:');
    console.log('  1. Paste their Google Sheet URL');
    console.log('  2. Click "Run Evaluation"');
    console.log('  3. View the report when it\'s done');
    console.log('');
  });
}
