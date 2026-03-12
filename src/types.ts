/**
 * Shared types for the Evergreen pipeline.
 *
 * Flow: Google Sheet → SheetRow[] → EvergreenConfig → Promptfoo YAML
 *       Promptfoo JSON → EvalResults → HTML Report
 */

// ── Multi-turn conversation types ──

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PresetPersona {
  id: string;
  label: string;
}

// ── Google Sheet row (one test case) ──

export interface SheetRow {
  question: string;
  expectedAnswer: string;
  context: string;
  metric: EvalMetric;
  severity: Severity;
  turns?: ConversationTurn[];  // seeded prior exchanges (preset-only)
  persona?: string;             // persona id (preset-only)
}

export type EvalMetric =
  | 'safety'
  | 'accuracy'
  | 'ease-of-use'
  | 'effectiveness'
  | 'emotion';

/** Internal Promptfoo assertion types — not exposed to test makers */
export type CheckType =
  | 'contains'
  | 'icontains'
  | 'not-contains'
  | 'contains-all'
  | 'regex'
  | 'llm-rubric';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

// ── Builder test case (structured criteria for the builder UI) ──

export interface BuilderTestCase {
  question: string;
  context: string;
  metric: EvalMetric | '';
  severity: Severity | '';
  should: string[];
  shouldNot: string[];
  capability?: string;
  turns?: ConversationTurn[];  // seeded prior exchanges (preset-only)
  persona?: string;             // persona id (preset-only)
}

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
  defaultTest?: { options?: { provider?: string } };
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
  // New promptfoo format (0.110+): top-level wrapper
  evalId?: string;
  results: PromptfooResultsWrapper | PromptfooResult[];
  stats?: {
    successes: number;
    failures: number;
    errors: number;
  };
}

/** Newer promptfoo wraps results + stats under a "results" key */
export interface PromptfooResultsWrapper {
  version: number;
  timestamp: string;
  results: PromptfooResult[];
  stats: {
    successes: number;
    failures: number;
    errors: number;
  };
}

/** Normalise the two possible output shapes into a consistent form */
export function normalizePromptfooOutput(raw: PromptfooOutput): {
  results: PromptfooResult[];
  stats: { successes: number; failures: number; errors: number };
} {
  if (raw.evalId && raw.results && !Array.isArray(raw.results)) {
    // New format: { evalId, results: { results: [...], stats: {...} } }
    const wrapper = raw.results as PromptfooResultsWrapper;
    return { results: wrapper.results, stats: wrapper.stats };
  }
  // Old format: { results: [...], stats: {...} }
  return {
    results: raw.results as PromptfooResult[],
    stats: raw.stats!,
  };
}

export interface PromptfooResult {
  prompt: { raw: string };
  provider: { id: string; label?: string };
  vars: Record<string, string>;
  response?: {
    output: string;
    tokenUsage?: { prompt: number; completion: number; total: number };
  };
  success: boolean;
  score: number;
  latencyMs?: number;
  namedScores?: Record<string, number>;
  gradingResult?: {
    pass: boolean;
    reason: string;
    componentResults?: Array<{ pass: boolean; reason: string }>;
  };
}

// ── Report types ──

export interface EvalResults {
  title: string;
  date: string;
  providers: string[];
  testSource: string;
  systemPrompt?: string;
  testCases: TestCaseResult[];
  agencyName?: string;
  evaluatorName?: string;
  evaluationReason?: string;
  presetId?: string;
}

export interface TestCaseResult {
  number: number;
  question: string;
  expected: string;
  context: string;
  metric: EvalMetric;
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** One entry per provider, in same order as EvalResults.providers */
  results: ProviderResult[];
  turns?: ConversationTurn[];  // seeded prior exchanges, for report display
  persona?: string;             // persona id, for report badge
}

export interface ProviderResult {
  provider: string;
  response: string;
  passed: boolean;
  gradingReason: string;
}
