/**
 * Config generator.
 *
 * Converts SheetRows + EvergreenConfig into a Promptfoo YAML config file.
 * This is the bridge between the Google Sheet (non-technical) and Promptfoo (technical).
 */

import * as fs from 'fs';
import * as YAML from 'yaml';
import {
  SheetRow,
  EvergreenConfig,
  PromptfooConfig,
  PromptfooProvider,
  PromptfooTest,
  PromptfooAssertion,
} from './types';

/**
 * Convert sheet rows + evergreen config into a Promptfoo config object.
 */
export function buildPromptfooConfig(
  rows: SheetRow[],
  config: EvergreenConfig,
): PromptfooConfig {
  const providers: PromptfooProvider[] = config.providers.map(p => {
    const provider: PromptfooProvider = { id: p.id };
    // Merge system prompt from provider-specific or default
    const systemPrompt = p.systemPrompt || config.defaultSystemPrompt;
    if (systemPrompt) {
      provider.config = { systemPrompt };
    }
    return provider;
  });

  const tests: PromptfooTest[] = rows.map((row, i) => {
    const test: PromptfooTest = {
      vars: {
        question: row.question,
      },
      assert: buildAssertions(row),
      metadata: {
        severity: row.severity,
        context: row.context,
        testNumber: String(i + 1),
      },
    };

    // If the test has context, prepend it to the question var
    // so the LLM sees "Context: ... \n Question: ..."
    if (row.context) {
      test.vars.question = `Context: ${row.context}\n\nQuestion: ${row.question}`;
    }

    return test;
  });

  return {
    description: config.description,
    prompts: ['{{question}}'],
    providers,
    tests,
    outputPath: config.outputPath || './results.json',
  };
}

/**
 * Convert a SheetRow's checkType + expectedAnswer into Promptfoo assertions.
 */
function buildAssertions(row: SheetRow): PromptfooAssertion[] {
  switch (row.checkType) {
    case 'contains':
      return [{ type: 'contains', value: row.expectedAnswer }];

    case 'not-contains':
      return [{ type: 'not-contains', value: row.expectedAnswer }];

    case 'contains-all':
      // Expected answer is comma-separated list; split into individual assertions
      return row.expectedAnswer.split(',').map(item => ({
        type: 'contains',
        value: item.trim(),
      }));

    case 'regex':
      return [{ type: 'regex', value: row.expectedAnswer }];

    case 'llm-rubric':
      return [{ type: 'llm-rubric', value: row.expectedAnswer }];

    default:
      return [{ type: 'contains', value: row.expectedAnswer }];
  }
}

/**
 * Write the Promptfoo config to a YAML file.
 */
export function writePromptfooConfig(config: PromptfooConfig, outPath: string): void {
  const yamlStr = YAML.stringify(config, { lineWidth: 120 });
  fs.writeFileSync(outPath, yamlStr, 'utf-8');
}

/**
 * Load an evergreen.yaml config file.
 */
export function loadEvergreenConfig(configPath: string): EvergreenConfig {
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = YAML.parse(raw);

  // Validate required fields
  if (!parsed.sheetId) {
    throw new Error(`Missing "sheetId" in ${configPath}. This is the Google Sheet ID from the URL.`);
  }
  if (!parsed.providers || !Array.isArray(parsed.providers) || parsed.providers.length === 0) {
    throw new Error(`Missing "providers" in ${configPath}. Add at least one provider (e.g. openai:gpt-4o).`);
  }

  return {
    description: parsed.description || 'Evergreen Evaluation',
    sheetId: parsed.sheetId,
    sheetRange: parsed.sheetRange || 'A2:E',
    providers: parsed.providers.map((p: string | { id: string; systemPrompt?: string }) => {
      if (typeof p === 'string') return { id: p };
      return { id: p.id, systemPrompt: p.systemPrompt };
    }),
    defaultSystemPrompt: parsed.defaultSystemPrompt,
    llmRubricProvider: parsed.llmRubricProvider,
    outputPath: parsed.outputPath || './results.json',
  };
}
