/**
 * Report Generator
 *
 * Takes structured eval results (JSON) and produces a single-file HTML report
 * with three tabs: Summary (Policy), Analysis (Operations), Details (Technical).
 *
 * Usage:
 *   import { generateReport } from './generator';
 *   const html = generateReport(evalResults);
 *   fs.writeFileSync('report.html', html);
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------- Types ----------

export interface EvalResults {
  title: string;
  date: string;
  providers: string[];
  testSource: string;
  testCases: TestCaseResult[];
}

export interface TestCaseResult {
  number: number;
  question: string;
  expected: string;
  context: string;
  checkType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** One entry per provider, in same order as EvalResults.providers */
  results: ProviderResult[];
}

export interface ProviderResult {
  provider: string;
  response: string;
  passed: boolean;
  gradingReason: string;
}

// ---------- Derived Data ----------

interface ReportData {
  title: string;
  date: string;
  testCaseCount: number;
  providerList: string;
  readinessClass: string;
  readinessLabel: string;
  recommendationText: string;
  criticalFailureCount: number;
  hasCriticalFailures: boolean;
  multipleProviders: boolean;
  testSource: string;
  gradingMethods: string;
  generatedAt: string;
  providers: ProviderSummary[];
  criticalFailures: CriticalFailure[];
  dimensions: DimensionResult[];
  patternNote: string;
  severities: SeverityRow[];
  testCases: TestCaseView[];
}

interface ProviderSummary {
  name: string;
  passRate: number;
  passRateClass: string;
  criticalFailures: number;
  avgResponseLength: number;
}

interface CriticalFailure {
  testNumber: number;
  question: string;
  provider: string;
  responseSummary: string;
  impact: string;
}

interface DimensionResult {
  name: string;
  passRate: number;
  barColor: string;
}

interface SeverityRow {
  level: string;
  total: number;
  results: { passed: number; total: number }[];
}

interface TestCaseView {
  number: number;
  question: string;
  severity: string;
  checkType: string;
  expected: string;
  rowClass: string;
  results: {
    providerName: string;
    resultClass: string;
    resultLabel: string;
    response: string;
    gradingReason: string;
  }[];
  colspan: number;
}

// ---------- Analysis ----------

function deriveReportData(input: EvalResults): ReportData {
  const providers: ProviderSummary[] = input.providers.map((name, pi) => {
    const results = input.testCases.map(tc => tc.results[pi]);
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const criticalFails = input.testCases
      .filter(tc => tc.severity === 'critical' && !tc.results[pi].passed).length;
    const avgLen = total > 0
      ? Math.round(results.reduce((sum, r) => sum + r.response.length, 0) / total)
      : 0;
    return {
      name,
      passRate,
      passRateClass: passRate >= 90 ? 'pass' : passRate >= 70 ? 'neutral' : 'fail',
      criticalFailures: criticalFails,
      avgResponseLength: avgLen,
    };
  });

  const criticalFailures: CriticalFailure[] = [];
  for (const tc of input.testCases) {
    if (tc.severity !== 'critical') continue;
    for (const r of tc.results) {
      if (!r.passed) {
        criticalFailures.push({
          testNumber: tc.number,
          question: tc.question,
          provider: r.provider,
          responseSummary: r.response.length > 120
            ? r.response.slice(0, 120) + '...'
            : r.response,
          impact: deriveImpact(tc),
        });
      }
    }
  }

  // Readiness
  const hasCritical = criticalFailures.length > 0;
  const bestPassRate = Math.max(...providers.map(p => p.passRate));
  let readinessClass: string;
  let readinessLabel: string;
  let recommendationText: string;

  if (hasCritical) {
    readinessClass = 'not-ready';
    readinessLabel = 'Not Ready for Deployment';
    recommendationText = `<strong>Not recommended for deployment.</strong> There are ${criticalFailures.length} critical failure(s) that could directly harm users. Address the critical items listed above and re-run the evaluation.`;
  } else if (bestPassRate < 80) {
    readinessClass = 'caution';
    readinessLabel = 'Needs Improvement';
    recommendationText = `<strong>Proceed with caution.</strong> No critical failures were found, but the overall pass rate (${bestPassRate}%) suggests the system needs tuning before deployment. Review the failing test cases and consider updating the system prompt or adding retrieval.`;
  } else {
    readinessClass = 'ready';
    readinessLabel = 'Ready for Deployment';
    recommendationText = `<strong>This system appears ready for deployment.</strong> All critical test cases passed and the overall pass rate is ${bestPassRate}%. Consider scheduling periodic re-evaluation as policies or data change.`;
  }

  // Dimensions — inferred from check types as a proxy
  const dimensionMap: Record<string, string> = {
    'contains': 'Factual Accuracy',
    'not-contains': 'Factual Accuracy',
    'contains-all': 'Practical Navigation',
    'regex': 'Factual Accuracy',
    'llm-rubric': 'Communication Quality',
  };
  const dimCounts: Record<string, { passed: number; total: number }> = {};
  for (const tc of input.testCases) {
    const dim = dimensionMap[tc.checkType] || 'Other';
    if (!dimCounts[dim]) dimCounts[dim] = { passed: 0, total: 0 };
    const anyPassed = tc.results.some(r => r.passed);
    dimCounts[dim].total++;
    if (anyPassed) dimCounts[dim].passed++;
  }
  // Add contextual understanding for tests with context
  const contextualTests = input.testCases.filter(tc => tc.context && tc.context.trim() !== '');
  if (contextualTests.length > 0) {
    const passed = contextualTests.filter(tc => tc.results.some(r => r.passed)).length;
    dimCounts['Contextual Understanding'] = { passed, total: contextualTests.length };
  }

  const dimensions: DimensionResult[] = Object.entries(dimCounts).map(([name, d]) => {
    const rate = d.total > 0 ? Math.round((d.passed / d.total) * 100) : 0;
    return {
      name,
      passRate: rate,
      barColor: rate >= 80 ? 'green' : rate >= 60 ? 'yellow' : 'red',
    };
  });

  // Pattern note
  let patternNote = '';
  const lowestDim = dimensions.reduce((a, b) => a.passRate < b.passRate ? a : b, dimensions[0]);
  if (lowestDim && lowestDim.passRate < 80) {
    patternNote = `Weakest area: ${lowestDim.name} (${lowestDim.passRate}%). Consider adding more test coverage and tuning the system prompt for this dimension.`;
  }

  // Severity rows
  const severityLevels: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
  const severities: SeverityRow[] = severityLevels.map(level => {
    const cases = input.testCases.filter(tc => tc.severity === level);
    return {
      level,
      total: cases.length,
      results: input.providers.map((_name, pi) => ({
        passed: cases.filter(tc => tc.results[pi].passed).length,
        total: cases.length,
      })),
    };
  }).filter(s => s.total > 0);

  // Test case views
  const colCount = 5 + input.providers.length;
  const testCases: TestCaseView[] = input.testCases.map(tc => {
    const anyFail = tc.results.some(r => !r.passed);
    return {
      number: tc.number,
      question: tc.question,
      severity: tc.severity,
      checkType: tc.checkType,
      expected: tc.expected,
      rowClass: anyFail ? 'fail-row' : '',
      colspan: colCount,
      results: tc.results.map(r => ({
        providerName: r.provider,
        resultClass: r.passed ? 'result-pass' : 'result-fail',
        resultLabel: r.passed ? 'PASS' : 'FAIL',
        response: r.response,
        gradingReason: r.gradingReason,
      })),
    };
  });

  // Grading methods used
  const methods = [...new Set(input.testCases.map(tc => tc.checkType))].join(', ');

  return {
    title: input.title,
    date: input.date,
    testCaseCount: input.testCases.length,
    providerList: input.providers.join(', '),
    readinessClass,
    readinessLabel,
    recommendationText,
    criticalFailureCount: criticalFailures.length,
    hasCriticalFailures: hasCritical,
    multipleProviders: input.providers.length > 1,
    testSource: input.testSource,
    gradingMethods: methods,
    generatedAt: new Date().toISOString(),
    providers,
    criticalFailures,
    dimensions,
    patternNote,
    severities,
    testCases,
  };
}

function deriveImpact(tc: TestCaseResult): string {
  // Simple heuristic — in a real system this could be a field in the sheet
  if (tc.checkType === 'not-contains') {
    return 'Potentially harmful misinformation could reach users';
  }
  if (tc.checkType === 'contains' || tc.checkType === 'regex') {
    return 'Users may receive incorrect factual information';
  }
  return 'Users may not receive the guidance they need';
}

// ---------- HTML Rendering ----------

/**
 * Render the report data into the HTML template.
 * Uses simple string replacement — no template engine dependency.
 */
function renderHtml(data: ReportData): string {
  // Build sections as raw HTML strings, then inject into the template shell

  // Provider stat cards
  const providerStatsHtml = data.providers.map(p => `
    <div class="stat-card">
      <div class="stat-value ${p.passRateClass}">${p.passRate}%</div>
      <div class="stat-label">${esc(p.name)} pass rate</div>
    </div>
  `).join('');

  const statsGridHtml = `
    ${providerStatsHtml}
    <div class="stat-card">
      <div class="stat-value fail">${data.criticalFailureCount}</div>
      <div class="stat-label">Critical failures</div>
    </div>
    <div class="stat-card">
      <div class="stat-value neutral">${data.testCaseCount}</div>
      <div class="stat-label">Total test cases</div>
    </div>
  `;

  // Critical failures
  const criticalHtml = data.hasCriticalFailures ? `
    <div class="card">
      <h2>Critical Failures — Require Review Before Deployment</h2>
      ${data.criticalFailures.map(cf => `
        <div class="critical-failure">
          <div class="cf-question">#${cf.testNumber}: "${esc(cf.question)}"</div>
          <div class="cf-detail">${esc(cf.provider)} responded: "${esc(cf.responseSummary)}"</div>
          <div class="cf-impact">Impact: ${esc(cf.impact)}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  // Dimension bars
  const dimensionBarsHtml = data.dimensions.map(d => `
    <div class="bar-row">
      <span class="bar-label">${esc(d.name)}</span>
      <div class="bar-track">
        <div class="bar-fill ${d.barColor}" style="width: ${d.passRate}%"></div>
      </div>
      <span class="bar-pct">${d.passRate}%</span>
    </div>
  `).join('');

  const patternHtml = data.patternNote
    ? `<div class="pattern-note"><strong>Pattern:</strong> ${esc(data.patternNote)}</div>`
    : '';

  // Severity table
  const severityHeaders = data.providers.map(p => `<th>${esc(p.name)}</th>`).join('');
  const severityRows = data.severities.map(s => `
    <tr>
      <td><span class="severity-badge ${s.level}">${s.level}</span></td>
      <td>${s.total}</td>
      ${s.results.map(r => `<td>${r.passed}/${r.total} passed</td>`).join('')}
    </tr>
  `).join('');

  // Provider comparison
  const comparisonHtml = data.multipleProviders ? `
    <div class="card">
      <h2>Provider Comparison</h2>
      <table class="severity-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${data.providers.map(p => `<th>${esc(p.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Overall Pass Rate</td>
            ${data.providers.map(p => `<td><strong>${p.passRate}%</strong></td>`).join('')}
          </tr>
          <tr>
            <td>Critical Failures</td>
            ${data.providers.map(p => `<td>${p.criticalFailures}</td>`).join('')}
          </tr>
          <tr>
            <td>Avg Response Length</td>
            ${data.providers.map(p => `<td>${p.avgResponseLength} chars</td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div>
  ` : '';

  // Detail table
  const detailHeaders = data.providers.map(p => `<th>${esc(p.name)}</th>`).join('');
  const detailRows = data.testCases.map(tc => {
    const resultCells = tc.results.map(r =>
      `<td class="${r.resultClass}">${r.resultLabel}</td>`
    ).join('');

    const expandedResults = tc.results.map(r => `
      <h4>${esc(r.providerName)} Response</h4>
      <div class="response-text">${esc(r.response)}</div>
      <h4>${esc(r.providerName)} Grading</h4>
      <div class="grading-reason">${esc(r.gradingReason)}</div>
    `).join('');

    return `
      <tr class="${tc.rowClass}">
        <td>${tc.number}</td>
        <td>${esc(tc.question)}</td>
        <td><span class="severity-badge ${tc.severity}">${tc.severity}</span></td>
        <td>${esc(tc.checkType)}</td>
        ${resultCells}
        <td><button class="expand-btn" onclick="toggleDetail(${tc.number})">Details</button></td>
      </tr>
      <tr>
        <td colspan="${tc.colspan}">
          <div class="expanded-detail" id="detail-${tc.number}">
            <h4>Expected</h4>
            <div class="response-text">${esc(tc.expected)}</div>
            ${expandedResults}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Assemble full HTML
  return buildFullHtml({
    title: esc(data.title),
    date: esc(data.date),
    testCaseCount: data.testCaseCount,
    providerList: esc(data.providerList),
    readinessClass: data.readinessClass,
    readinessLabel: esc(data.readinessLabel),
    statsGridHtml,
    criticalHtml,
    recommendationText: data.recommendationText,
    dimensionBarsHtml,
    patternHtml,
    severityHeaders,
    severityRows,
    comparisonHtml,
    detailHeaders,
    detailRows,
    testSource: esc(data.testSource),
    gradingMethods: esc(data.gradingMethods),
    generatedAt: esc(data.generatedAt),
  });
}

function buildFullHtml(d: Record<string, string | number>): string {
  // Read the template and replace sections, or build inline
  // For portability, we build the full HTML inline here
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${d.title} — Evergreen Eval Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f5f6f8; color: #1a1a2e; line-height: 1.6; font-size: 15px;
  }
  .report-header { background: #1a1a2e; color: #fff; padding: 28px 32px; }
  .report-header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
  .report-header .meta { font-size: 13px; color: #a0a0b8; }
  .report-header .meta span + span::before { content: "·"; margin: 0 8px; }
  .readiness { display: inline-block; padding: 4px 14px; border-radius: 4px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 12px; }
  .readiness.ready { background: #d4edda; color: #155724; }
  .readiness.not-ready { background: #f8d7da; color: #721c24; }
  .readiness.caution { background: #fff3cd; color: #856404; }
  .tab-nav { display: flex; background: #fff; border-bottom: 2px solid #e0e0e8; padding: 0 32px; position: sticky; top: 0; z-index: 10; }
  .tab-btn { padding: 14px 24px; border: none; background: none; font-size: 14px; font-weight: 500; color: #666; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: color 0.15s, border-color 0.15s; }
  .tab-btn:hover { color: #1a1a2e; }
  .tab-btn.active { color: #1a1a2e; border-bottom-color: #2563eb; font-weight: 600; }
  .tab-btn .tab-label { display: block; }
  .tab-btn .tab-desc { display: block; font-size: 11px; font-weight: 400; color: #999; margin-top: 1px; }
  .tab-btn.active .tab-desc { color: #666; }
  .tab-content { display: none; padding: 28px 32px; max-width: 1100px; }
  .tab-content.active { display: block; }
  .card { background: #fff; border-radius: 8px; border: 1px solid #e0e0e8; padding: 24px; margin-bottom: 20px; }
  .card h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 16px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
  .stat-card { background: #fff; border: 1px solid #e0e0e8; border-radius: 8px; padding: 20px; text-align: center; }
  .stat-card .stat-value { font-size: 36px; font-weight: 700; line-height: 1.1; }
  .stat-card .stat-value.pass { color: #155724; }
  .stat-card .stat-value.fail { color: #721c24; }
  .stat-card .stat-value.neutral { color: #1a1a2e; }
  .stat-card .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-top: 4px; }
  .critical-failure { border-left: 4px solid #dc3545; padding: 14px 18px; margin-bottom: 12px; background: #fff5f5; border-radius: 0 6px 6px 0; }
  .critical-failure .cf-question { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
  .critical-failure .cf-detail { font-size: 13px; color: #555; }
  .critical-failure .cf-impact { font-size: 13px; color: #721c24; font-weight: 500; margin-top: 6px; }
  .recommendation { padding: 18px 22px; border-radius: 8px; font-size: 15px; line-height: 1.5; }
  .recommendation.not-ready { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
  .recommendation.ready { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
  .recommendation.caution { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; }
  .recommendation strong { font-weight: 600; }
  .bar-chart { margin: 12px 0; }
  .bar-row { display: flex; align-items: center; margin-bottom: 10px; }
  .bar-label { width: 180px; font-size: 13px; font-weight: 500; flex-shrink: 0; }
  .bar-track { flex: 1; height: 24px; background: #f0f0f5; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
  .bar-fill.green { background: #28a745; }
  .bar-fill.yellow { background: #ffc107; }
  .bar-fill.red { background: #dc3545; }
  .bar-pct { width: 50px; text-align: right; font-size: 13px; font-weight: 600; flex-shrink: 0; margin-left: 10px; }
  .severity-table { width: 100%; border-collapse: collapse; }
  .severity-table th, .severity-table td { padding: 10px 14px; text-align: left; font-size: 13px; border-bottom: 1px solid #eee; }
  .severity-table th { font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: #888; background: #fafafa; }
  .severity-badge { display: inline-block; padding: 2px 10px; border-radius: 3px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
  .severity-badge.critical { background: #f8d7da; color: #721c24; }
  .severity-badge.high { background: #fff3cd; color: #856404; }
  .severity-badge.medium { background: #d1ecf1; color: #0c5460; }
  .severity-badge.low { background: #e2e3e5; color: #383d41; }
  .pattern-note { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 14px 18px; font-size: 14px; color: #3730a3; margin-top: 16px; }
  .pattern-note strong { font-weight: 600; }
  .detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .detail-table th { padding: 10px 12px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: #888; background: #fafafa; border-bottom: 2px solid #e0e0e8; position: sticky; top: 52px; }
  .detail-table td { padding: 10px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
  .detail-table tr:hover { background: #f8f9ff; }
  .detail-table tr.fail-row { background: #fff8f8; }
  .detail-table tr.fail-row:hover { background: #fff0f0; }
  .result-pass { color: #155724; font-weight: 600; }
  .result-fail { color: #721c24; font-weight: 600; }
  .expand-btn { background: none; border: 1px solid #ccc; border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; color: #555; }
  .expand-btn:hover { background: #f0f0f5; }
  .expanded-detail { display: none; padding: 14px 16px; background: #f9f9fc; border: 1px solid #e0e0e8; border-radius: 6px; margin: 8px 0; }
  .expanded-detail.open { display: block; }
  .expanded-detail h4 { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #888; margin-bottom: 6px; margin-top: 12px; }
  .expanded-detail h4:first-child { margin-top: 0; }
  .expanded-detail .response-text { font-size: 13px; background: #fff; border: 1px solid #eee; border-radius: 4px; padding: 10px 14px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
  .expanded-detail .grading-reason { font-size: 13px; color: #555; }
  .methodology { padding: 20px 32px 40px; margin-top: 28px; border-top: 1px solid #e0e0e8; font-size: 13px; color: #888; }
  .methodology dt { font-weight: 600; color: #555; display: inline; }
  .methodology dd { display: inline; margin-left: 4px; margin-right: 16px; }
  @media print {
    body { background: #fff; }
    .tab-nav { position: static; }
    .tab-content { display: block !important; page-break-before: always; }
    .tab-content:first-of-type { page-break-before: auto; }
    .expand-btn { display: none; }
    .expanded-detail { display: block !important; }
  }
</style>
</head>
<body>

<header class="report-header">
  <h1>${d.title}</h1>
  <div class="meta">
    <span>${d.date}</span>
    <span>${d.testCaseCount} test cases</span>
    <span>${d.providerList}</span>
  </div>
  <div class="readiness ${d.readinessClass}">${d.readinessLabel}</div>
</header>

<nav class="tab-nav">
  <button class="tab-btn active" data-tab="summary">
    <span class="tab-label">Summary</span>
    <span class="tab-desc">Policy &amp; Leadership</span>
  </button>
  <button class="tab-btn" data-tab="analysis">
    <span class="tab-label">Analysis</span>
    <span class="tab-desc">Operations</span>
  </button>
  <button class="tab-btn" data-tab="details">
    <span class="tab-label">Details</span>
    <span class="tab-desc">Technical</span>
  </button>
</nav>

<section class="tab-content active" id="tab-summary">
  <div class="stats-grid">${d.statsGridHtml}</div>
  ${d.criticalHtml}
  <div class="card">
    <h2>Recommendation</h2>
    <div class="recommendation ${d.readinessClass}">${d.recommendationText}</div>
  </div>
</section>

<section class="tab-content" id="tab-analysis">
  <div class="card">
    <h2>Results by Evaluation Dimension</h2>
    <div class="bar-chart">${d.dimensionBarsHtml}</div>
    ${d.patternHtml}
  </div>
  <div class="card">
    <h2>Results by Severity</h2>
    <table class="severity-table">
      <thead><tr><th>Severity</th><th>Total</th>${d.severityHeaders}</tr></thead>
      <tbody>${d.severityRows}</tbody>
    </table>
  </div>
  ${d.comparisonHtml}
</section>

<section class="tab-content" id="tab-details">
  <div class="card" style="padding: 12px;">
    <table class="detail-table">
      <thead><tr><th>#</th><th>Question</th><th>Severity</th><th>Check Type</th>${d.detailHeaders}<th></th></tr></thead>
      <tbody>${d.detailRows}</tbody>
    </table>
  </div>
</section>

<footer class="methodology">
  <dl>
    <dt>Framework:</dt><dd>Evergreen 4-Dimension Eval</dd>
    <dt>Test Source:</dt><dd>${d.testSource}</dd>
    <dt>Providers:</dt><dd>${d.providerList}</dd>
    <dt>Grading:</dt><dd>${d.gradingMethods}</dd>
    <dt>Generated:</dt><dd>${d.generatedAt}</dd>
  </dl>
</footer>

<script>
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
  function toggleDetail(num) {
    var el = document.getElementById('detail-' + num);
    if (el) { el.classList.toggle('open'); }
  }
</script>
</body>
</html>`;
}

/** HTML-escape a string */
function esc(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Public API ----------

export function generateReport(input: EvalResults): string {
  const data = deriveReportData(input);
  return renderHtml(data);
}

/**
 * Generate a report from a JSON file and write HTML to disk.
 */
export function generateReportFromFile(inputPath: string, outputPath: string): void {
  const raw = fs.readFileSync(inputPath, 'utf-8');
  const input: EvalResults = JSON.parse(raw);
  const html = generateReport(input);
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`Report written to ${outputPath}`);
}

// CLI usage: ts-node generator.ts input.json output.html
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: ts-node generator.ts <input.json> <output.html>');
    process.exit(1);
  }
  generateReportFromFile(args[0], args[1]);
}
