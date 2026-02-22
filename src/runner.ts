/**
 * Promptfoo runner.
 *
 * Invokes Promptfoo to execute evals and captures the JSON output.
 * Uses Promptfoo's CLI as a subprocess so we don't depend on internal APIs.
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
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

  try {
    execSync(
      `npx promptfoo eval --config "${absConfig}" --output "${absOutput}" --no-cache`,
      {
        stdio: 'inherit',
        timeout: 5 * 60 * 1000, // 5 minute timeout
        env: {
          ...process.env,
          PROMPTFOO_DISABLE_TELEMETRY: '1',
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Promptfoo eval failed. This usually means:\n` +
      `  - An API key is missing (set OPENAI_API_KEY or ANTHROPIC_API_KEY)\n` +
      `  - The provider ID in your config is wrong\n` +
      `  - Network issues connecting to the LLM provider\n\n` +
      `Details: ${msg}`
    );
  }

  if (!fs.existsSync(absOutput)) {
    throw new Error(
      `Promptfoo finished but no output file found at ${absOutput}. ` +
      `This is unexpected — check the Promptfoo output above for errors.`
    );
  }

  const raw = fs.readFileSync(absOutput, 'utf-8');
  return JSON.parse(raw) as PromptfooOutput;
}

/**
 * Async version of runPromptfoo for use in the web server.
 * Uses child_process.exec wrapped in a Promise so it doesn't block the event loop.
 */
export function runPromptfooAsync(configPath: string, outputPath: string): Promise<PromptfooOutput> {
  const absConfig = path.resolve(configPath);
  const absOutput = path.resolve(outputPath);

  return new Promise((resolve, reject) => {
    exec(
      `npx promptfoo eval --config "${absConfig}" --output "${absOutput}" --no-cache`,
      {
        timeout: 5 * 60 * 1000,
        env: {
          ...process.env,
          PROMPTFOO_DISABLE_TELEMETRY: '1',
        },
      },
      (err) => {
        if (err) {
          reject(new Error(
            `Promptfoo eval failed. This usually means:\n` +
            `  - An API key is missing (set OPENAI_API_KEY or ANTHROPIC_API_KEY)\n` +
            `  - The provider ID in your config is wrong\n` +
            `  - Network issues connecting to the LLM provider\n\n` +
            `Details: ${err.message}`
          ));
          return;
        }

        if (!fs.existsSync(absOutput)) {
          reject(new Error(
            `Promptfoo finished but no output file found at ${absOutput}.`
          ));
          return;
        }

        const raw = fs.readFileSync(absOutput, 'utf-8');
        resolve(JSON.parse(raw) as PromptfooOutput);
      },
    );
  });
}
