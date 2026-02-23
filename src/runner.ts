/**
 * Promptfoo runner.
 *
 * Invokes Promptfoo to execute evals and captures the JSON output.
 * Uses Promptfoo's CLI as a subprocess so we don't depend on internal APIs.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PromptfooOutput } from './types';

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

  try {
    execSync(
      `npx promptfoo eval --config "${absConfig}" --output "${absOutput}" --no-cache`,
      {
        stdio: 'inherit',
        timeout: 5 * 60 * 1000, // 5 minute timeout
        env: {
          ...process.env,
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
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Promptfoo eval failed. This usually means:\n` +
        `  - An API key is missing (set OPENAI_API_KEY or ANTHROPIC_API_KEY)\n` +
        `  - The provider ID in your config is wrong\n` +
        `  - Network issues connecting to the LLM provider\n\n` +
        `Details: ${msg}`
      );
    }
  }

  const raw = fs.readFileSync(absOutput, 'utf-8');
  try { fs.rmSync(pfTmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  return JSON.parse(raw) as PromptfooOutput;
}
