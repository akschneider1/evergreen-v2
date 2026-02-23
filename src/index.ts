#!/usr/bin/env node

/**
 * Evergreen CLI
 *
 * Usage:
 *   npx evergreen run              # sync sheet → run evals → generate report
 *   npx evergreen run -c config.yaml
 *
 * This is the single command a technical colleague runs.
 * Everything else (writing test cases, reading the report) happens outside the CLI.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { loadEvergreenConfig } from './config';
import { buildPromptfooConfig, writePromptfooConfig } from './config';
import { fetchSheet } from './sheets';
import { runPromptfoo } from './runner';
import { mapToEvalResults } from './mapper';
import { generateReport } from './report/generator';
import { normalizePromptfooOutput } from './types';
import { startApp } from './web/server';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command === 'serve') {
    const reportPath = getFlagValue(args, '-o', '--output') || 'report.html';
    const port = parseInt(getFlagValue(args, '-p', '--port') || '4000', 10);
    serveReport(reportPath, port);
    return;
  }

  if (command === 'app') {
    const port = parseInt(getFlagValue(args, '-p', '--port') || '4000', 10);
    startApp(port);
    return;
  }

  if (command !== 'run') {
    console.error(`Unknown command: ${command}`);
    console.error('Run "evergreen --help" for usage.');
    process.exit(1);
  }

  // Parse flags
  const configPath = getFlagValue(args, '-c', '--config') || 'evergreen.yaml';
  const reportPath = getFlagValue(args, '-o', '--output') || 'report.html';

  // ── Step 1: Load config ──
  console.log('');
  console.log('┌─────────────────────────────────────────┐');
  console.log('│  Evergreen — Pre-Deployment AI Eval     │');
  console.log('└─────────────────────────────────────────┘');
  console.log('');

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.error('');
    console.error('Create an evergreen.yaml file with:');
    console.error('');
    console.error('  description: "My AI Chatbot Eval"');
    console.error('  sheetId: "your-google-sheet-id"');
    console.error('  providers:');
    console.error('    - openai:gpt-4o');
    console.error('');
    console.error('Or specify a path: evergreen run -c path/to/config.yaml');
    process.exit(1);
  }

  const config = loadEvergreenConfig(configPath);
  console.log(`Config:    ${configPath}`);
  console.log(`Sheet ID:  ${config.sheetId}`);
  console.log(`Providers: ${config.providers.map(p => p.id).join(', ')}`);
  console.log('');

  // ── Step 2: Fetch Google Sheet ──
  console.log('Step 1/4 — Fetching test cases from Google Sheet...');
  const rows = await fetchSheet(config.sheetId);
  console.log(`  Found ${rows.length} test cases.`);
  console.log('');

  // ── Step 3: Generate Promptfoo config ──
  console.log('Step 2/4 — Generating Promptfoo config...');
  const pfConfig = buildPromptfooConfig(rows, config);
  const pfConfigPath = path.join(path.dirname(configPath), '.promptfoo-config.yaml');
  writePromptfooConfig(pfConfig, pfConfigPath);
  console.log(`  Written to ${pfConfigPath}`);
  console.log('');

  // ── Step 4: Run Promptfoo ──
  console.log('Step 3/4 — Running evaluations...');
  console.log('');
  const outputPath = config.outputPath || './results.json';
  const pfRaw = runPromptfoo(pfConfigPath, outputPath);
  const pfOutput = normalizePromptfooOutput(pfRaw);
  console.log('');
  console.log(`  Promptfoo complete: ${pfOutput.stats.successes} passed, ${pfOutput.stats.failures} failed`);
  console.log('');

  // ── Step 5: Generate report ──
  console.log('Step 4/4 — Generating report...');
  const evalResults = mapToEvalResults(pfOutput, rows, config.description);
  const html = generateReport(evalResults);
  fs.writeFileSync(reportPath, html, 'utf-8');
  console.log(`  Report written to ${reportPath}`);
  console.log('');

  // ── Done ──
  console.log('┌─────────────────────────────────────────┐');
  console.log('│  Done! Open the report in your browser: │');
  console.log(`│  ${reportPath.padEnd(38)}│`);
  console.log('└─────────────────────────────────────────┘');
  console.log('');

  // Clean up intermediate config
  try { fs.unlinkSync(pfConfigPath); } catch { /* ignore */ }
}

function serveReport(reportPath: string, port: number): void {
  const absPath = path.resolve(reportPath);

  if (!fs.existsSync(absPath)) {
    console.error(`Report not found: ${absPath}`);
    console.error('');
    console.error('Generate one first with: evergreen run');
    process.exit(1);
  }

  const server = http.createServer((_req, res) => {
    const html = fs.readFileSync(absPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  server.listen(port, () => {
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  Evergreen — Report Server              │');
    console.log('└─────────────────────────────────────────┘');
    console.log('');
    console.log(`  Report:  ${absPath}`);
    console.log(`  URL:     http://localhost:${port}`);
    console.log('');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
  });
}

function printUsage(): void {
  console.log(`
Evergreen — Pre-Deployment AI Evaluation

Usage:
  evergreen run                     Fetch test cases, run evals, generate report
  evergreen run -c config.yaml      Use a specific config file
  evergreen run -o report.html      Specify output report path
  evergreen serve                   Serve the report in your browser (port 4000)
  evergreen serve -o report.html    Serve a specific report file
  evergreen serve -p 3000           Serve on a custom port
  evergreen app                     Launch the unified web app (input + output, port 4000)
  evergreen app -p 3000             Launch on a custom port

Config file (evergreen.yaml):
  description: "CO Tax Policy Chatbot Eval"
  sheetId: "your-google-sheet-id-from-url"
  providers:
    - openai:gpt-4o
    - anthropic:claude-sonnet-4-20250514
  defaultSystemPrompt: |
    You are a helpful assistant for Colorado tax questions.

Environment variables:
  OPENAI_API_KEY        Required for OpenAI providers
  ANTHROPIC_API_KEY     Required for Anthropic providers
`);
}

function getFlagValue(args: string[], short: string, long: string): string | undefined {
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === short || args[i] === long) {
      return args[i + 1];
    }
  }
  return undefined;
}

main().catch(err => {
  console.error('');
  console.error('Error:', err.message || err);
  process.exit(1);
});
