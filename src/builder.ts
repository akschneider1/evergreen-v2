/**
 * Builder utilities — conversion between BuilderTestCase and SheetRow formats,
 * plus CSV export for the test suite builder UI.
 */

import { SheetRow, BuilderTestCase, EvalMetric, Severity } from './types';
import { PresetSuite } from './presets/index';

/** Convert a BuilderTestCase to a SheetRow for the eval pipeline. */
export function builderCaseToSheetRow(bc: BuilderTestCase): SheetRow {
  const parts: string[] = [];
  if (bc.should.length > 0) {
    parts.push('SHOULD: ' + bc.should.filter(Boolean).join('; '));
  }
  if (bc.shouldNot.length > 0) {
    parts.push('SHOULD NOT: ' + bc.shouldNot.filter(Boolean).join('; '));
  }
  return {
    question: bc.question,
    expectedAnswer: parts.join(' | '),
    context: bc.context,
    metric: bc.metric as EvalMetric,
    severity: bc.severity as Severity,
    ...(bc.turns    ? { turns:   bc.turns   } : {}),
    ...(bc.persona  ? { persona: bc.persona } : {}),
  };
}

/** Convert a SheetRow to a BuilderTestCase (for presets without hand-authored builderCases). */
export function sheetRowToBuilderCase(row: SheetRow): BuilderTestCase {
  const should: string[] = [];
  const shouldNot: string[] = [];

  if (row.metric === 'safety') {
    // Safety expectedAnswer describes what the AI should NOT do
    if (row.expectedAnswer) shouldNot.push(row.expectedAnswer);
  } else {
    // All other metrics: expectedAnswer describes what to check for
    if (row.expectedAnswer) should.push(row.expectedAnswer);
  }

  return {
    question: row.question,
    context: row.context,
    metric: row.metric,
    severity: row.severity,
    should,
    shouldNot,
    ...(row.turns   ? { turns:   row.turns   } : {}),
    ...(row.persona ? { persona: row.persona } : {}),
  };
}

/** Get BuilderTestCase[] for a preset — uses hand-authored if available, else auto-generates. */
export function getBuilderCases(preset: PresetSuite): BuilderTestCase[] {
  if (preset.builderCases && preset.builderCases.length > 0) {
    return preset.builderCases;
  }
  return preset.rows.map(sheetRowToBuilderCase);
}

/** Compute metric distribution for a set of builder cases. */
export function metricDistribution(cases: BuilderTestCase[]): Record<string, number> {
  const dist: Record<string, number> = {
    safety: 0,
    accuracy: 0,
    'ease-of-use': 0,
    effectiveness: 0,
    emotion: 0,
  };
  for (const c of cases) {
    if (c.metric && c.metric in dist) {
      dist[c.metric]++;
    }
  }
  return dist;
}

// ── CSV export ──

const METRIC_DISPLAY: Record<string, string> = {
  safety: 'Safety',
  accuracy: 'Accuracy',
  'ease-of-use': 'Ease of Use',
  effectiveness: 'Effectiveness',
  emotion: 'Emotion',
};

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** Convert an array of BuilderTestCases to CSV matching the Google Sheet format. */
export function builderCasesToCsv(cases: BuilderTestCase[]): string {
  const header = 'Question,What to check,Context,Metric,Severity';
  const rows = cases.map(bc => {
    const row = builderCaseToSheetRow(bc);
    return [
      csvEscape(row.question),
      csvEscape(row.expectedAnswer),
      csvEscape(row.context),
      csvEscape(METRIC_DISPLAY[row.metric] || row.metric),
      csvEscape(capitalize(row.severity)),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}
