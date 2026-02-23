/**
 * Promptfoo → Report mapper.
 *
 * Transforms Promptfoo's JSON output into the EvalResults shape
 * expected by the report generator.
 */

import { SheetRow, PromptfooResult, EvalResults, TestCaseResult, ProviderResult } from './types';

/**
 * Map Promptfoo output + original sheet rows into EvalResults for the report.
 *
 * Promptfoo's results are flat (one entry per test×provider combo).
 * We need to group them by test case and attach the original metadata
 * (severity, context, checkType) from the sheet rows.
 */
export function mapToEvalResults(
  output: { results: PromptfooResult[]; stats: { successes: number; failures: number; errors: number } },
  rows: SheetRow[],
  title: string,
): EvalResults {
  // Extract unique providers from results
  const providerIds = [
    ...new Set(output.results.map(r => r.provider.label || r.provider.id)),
  ];

  // Group results by test case number
  // Promptfoo results are ordered: all providers for test 1, then all for test 2, etc.
  const testCaseCount = rows.length;
  const resultsPerTest = providerIds.length;

  const testCases: TestCaseResult[] = [];

  for (let t = 0; t < testCaseCount; t++) {
    const row = rows[t];
    const providerResults: ProviderResult[] = [];

    for (let p = 0; p < resultsPerTest; p++) {
      const idx = t * resultsPerTest + p;
      const pfResult = output.results[idx];

      if (!pfResult) {
        // If Promptfoo returned fewer results than expected, add a placeholder
        providerResults.push({
          provider: providerIds[p] || `Provider ${p + 1}`,
          response: '(no response)',
          passed: false,
          gradingReason: 'No result returned from Promptfoo',
        });
        continue;
      }

      const gradingReason = pfResult.gradingResult?.reason
        || (pfResult.success ? 'Assertion passed' : 'Assertion failed');

      providerResults.push({
        provider: pfResult.provider.label || pfResult.provider.id,
        response: pfResult.response?.output || '(no response)',
        passed: pfResult.success,
        gradingReason,
      });
    }

    testCases.push({
      number: t + 1,
      question: row.question,
      expected: row.expectedAnswer,
      context: row.context,
      checkType: row.checkType,
      severity: row.severity,
      results: providerResults,
    });
  }

  return {
    title,
    date: new Date().toISOString().split('T')[0],
    providers: providerIds,
    testSource: 'Google Sheets',
    testCases,
  };
}
