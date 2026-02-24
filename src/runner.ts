/**
 * Promptfoo runner.
 *
 * Invokes Promptfoo to execute evals and captures the JSON output.
 * Uses Promptfoo's CLI as a subprocess so we don't depend on internal APIs.
 */

import { execFile, execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PromptfooOutput } from './types';

/**
 * Validate that parsed JSON has the shape of a PromptfooOutput before we use it.
 * Throws a descriptive error if the structure is wrong.
 */
function validatePromptfooOutput(parsed: unknown): PromptfooOutput {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Promptfoo output is not a valid JSON object.');
  }
  const obj = parsed as Record<string, unknown>;
  // New format: { evalId, results: { results: [...], stats: {...} } }
  // Old format: { results: [...], stats: {...} }
  if (!('results' in obj)) {
    throw new Error('Promptfoo output is missing the "results" field. The evaluation may not have completed.');
  }
  if (obj.evalId && typeof obj.results === 'object' && !Array.isArray(obj.results)) {
    const wrapper = obj.results as Record<string, unknown>;
    if (!Array.isArray(wrapper.results)) {
      throw new Error('Promptfoo output has an unexpected format — nested results is not an array.');
    }
  } else if (!Array.isArray(obj.results)) {
    throw new Error('Promptfoo output has an unexpected format — results is not an array.');
  }
  return parsed as PromptfooOutput;
}

/**
 * Run Promptfoo eval against the generated config.
 *
 * @param configPath   Path to the Promptfoo YAML config
 * @param outputPath   Path where Promptfoo writes JSON results
 * @returns Parsed Promptfoo output
 */
export function runPromptfoo(configPath: string, outputPath: string): PromptfooOutput {
  const absConfig = path.resolve(configPath);
  const absOutput = path.resolve(outputPath);

  console.log(`Running Promptfoo eval...`);
  console.log(`  Config: ${absConfig}`);
  console.log(`  Output: ${absOutput}`);
  console.log('');

  // Use an isolated temp dir for promptfoo's SQLite database so a stale or
  // corrupt DB from a previous run never causes a FOREIGN KEY constraint error.
  const pfTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evergreen-pf-'));

  // Prepend the current Node.js binary directory to PATH so that child
  // processes (npx, promptfoo) use the same Node version as the server.
  // This is important in environments like Replit where multiple Node
  // versions may be on PATH and a stale v18 could be picked up first.
  const nodeBinDir = path.dirname(process.execPath);
  const childPath = `${nodeBinDir}${path.delimiter}${process.env.PATH ?? ''}`;

  try {
    execFileSync(
      'npx',
      ['promptfoo', 'eval', '--config', absConfig, '--output', absOutput, '--no-cache'],
      {
        stdio: 'inherit',
        timeout: 5 * 60 * 1000, // 5 minute timeout
        env: {
          ...process.env,
          PATH: childPath,
          PROMPTFOO_DISABLE_TELEMETRY: '1',
          PROMPTFOO_CONFIG_DIR: pfTmpDir,
        },
      },
    );
  } catch (err) {
    // Newer versions of promptfoo exit non-zero when test cases fail — that's
    // expected behaviour, not a crash.  Only treat it as fatal if the output
    // file wasn't produced.
    if (!fs.existsSync(absOutput)) {
      try { fs.rmSync(pfTmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      throw new Error(
        `The evaluation could not complete. Common causes:\n` +
        `  • Missing API key — make sure OPENAI_API_KEY or ANTHROPIC_API_KEY is set\n` +
        `  • Wrong provider — check that the selected LLM provider is correct\n` +
        `  • Network issue — check your internet connection\n` +
        `Try again, or contact your technical team if the problem continues.`
      );
    }
  }

  const raw = fs.readFileSync(absOutput, 'utf-8');
  try { fs.rmSync(pfTmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  return validatePromptfooOutput(JSON.parse(raw));
}

/**
 * Async (non-blocking) variant for use in the web server.
 * Uses execFile instead of execFileSync so the Node.js event loop
 * remains free to handle poll requests while the eval runs.
 */
export function runPromptfooAsync(configPath: string, outputPath: string): Promise<PromptfooOutput> {
  const absConfig = path.resolve(configPath);
  const absOutput = path.resolve(outputPath);
  const pfTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evergreen-pf-'));

  const nodeBinDir = path.dirname(process.execPath);
  const childPath = `${nodeBinDir}${path.delimiter}${process.env.PATH ?? ''}`;

  return new Promise((resolve, reject) => {
    const stderrChunks: Buffer[] = [];
    const child = execFile(
      'npx',
      ['promptfoo', 'eval', '--config', absConfig, '--output', absOutput, '--no-cache'],
      {
        timeout: 5 * 60 * 1000,
        env: {
          ...process.env,
          PATH: childPath,
          PROMPTFOO_DISABLE_TELEMETRY: '1',
          PROMPTFOO_CONFIG_DIR: pfTmpDir,
        },
      },
      (err) => {
        try { fs.rmSync(pfTmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
        const stderrText = Buffer.concat(stderrChunks).toString().trim();
        if (err && !fs.existsSync(absOutput)) {
          const hint = stderrText
            ? `\n\nDetails from the eval engine:\n${stderrText.slice(0, 500)}`
            : '';
          reject(new Error(
            `The evaluation could not complete. This usually means an API key is missing or the LLM provider couldn't be reached. ` +
            `Check your settings and try again.${hint}`
          ));
          return;
        }
        // Log stderr for debugging (visible in server logs on Replit, etc.)
        if (stderrText) {
          console.warn(`[Promptfoo stderr for ${path.basename(absConfig)}]\n${stderrText.slice(0, 2000)}`);
        }
        try {
          resolve(validatePromptfooOutput(JSON.parse(fs.readFileSync(absOutput, 'utf-8'))));
        } catch (readErr) {
          reject(new Error(
            `Could not read the evaluation results. The output file may be corrupted.\n` +
            `Details: ${readErr instanceof Error ? readErr.message : String(readErr)}`
          ));
        }
      },
    );
    // Capture stderr for diagnostics; discard stdout
    child.stdout?.resume();
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
  });
}
