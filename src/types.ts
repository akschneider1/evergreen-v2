/**
 * Shared types for the Evergreen pipeline.
 *
 * Flow: Google Sheet → SheetRow[] → EvergreenConfig → Promptfoo YAML
 *       Promptfoo JSON → EvalResults → HTML Report
 */

// ── Google Sheet row (one test case) ──

export interface SheetRow {
  question: string;
  expectedAnswer: string;
  context: string;
  checkType: CheckType;
  severity: Severity;
}

export type CheckType =
  | 'contains'
  | 'not-contains'
  | 'contains-all'
  | 'regex'
  | 'llm-rubric';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

// ── Evergreen config (evergreen.yaml) ──

export interface EvergreenConfig {
  description: string;
  sheetId: string;
  sheetRange: string;
  providers: ProviderConfig[];
  defaultSystemPrompt?: string;
  llmRubricProvider?: string;
  outputPath?: string;
}

export interface ProviderConfig {
  id: string;           // e.g. "openai:gpt-4o"
  systemPrompt?: string;
}

// ── Promptfoo types (subset we use) ──

export interface PromptfooConfig {
  description: string;
  prompts: string[];
  providers: PromptfooProvider[];
  tests: PromptfooTest[];
  outputPath: string;
}

export interface PromptfooProvider {
  id: string;
  config?: Record<string, unknown>;
}

export interface PromptfooTest {
  vars: Record<string, string>;
  assert: PromptfooAssertion[];
  metadata?: Record<string, string>;
}

export interface PromptfooAssertion {
  type: string;
  value?: string;
}

// ── Promptfoo output (subset we read) ──

export interface PromptfooOutput {
  results: PromptfooResult[];
  stats: {
    successes: number;
    failures: number;
    errors: number;
  };
}

export interface PromptfooResult {
  prompt: { raw: string };
  provider: { id: string; label?: string };
  vars: Record<string, string>;
  response?: { output: string };
  success: boolean;
  score: number;
  namedScores?: Record<string, number>;
  gradingResult?: {
    pass: boolean;
    reason: string;
    componentResults?: Array<{ pass: boolean; reason: string }>;
  };
}
