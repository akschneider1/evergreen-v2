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

// ---------- Public Types ----------

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

// ---------- Internal Derived Types ----------

interface ReportData {
  title: string;
  date: string;
  testCaseCount: number;
  failedCaseCount: number;
  criticalCaseCount: number;
  providerList: string;
  readinessClass: string;
  readinessLabel: string;
  readinessExplanation: string;
  nextSteps: string[];
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
  passed: number;
  total: number;
  passRate: number;
  passRateClass: string;
  criticalFailures: number;
  avgResponseLength: number;
}

interface CriticalFailure {
  testNumber: number;
  question: string;
  provider: string;
  expectedSummary: string;
  responseSummary: string;
  impact: string;
}

interface DimensionResult {
  name: string;
  passRate: number;
  passedCount: number;
  totalCount: number;
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
  checkTypeLabel: string;
  expected: string;
  anyFailed: boolean;
  results: {
    providerName: string;
    resultClass: string;
    resultLabel: string;
    response: string;
    enhancedGradingReason: string;
  }[];
  colspan: number;
}

// ---------- Helpers ----------

function checkTypeLabel(ct: string): string {
  const labels: Record<string, string> = {
    'contains': 'Contains',
    'not-contains': 'Not Contains',
    'contains-all': 'Contains All',
    'regex': 'Regex',
    'llm-rubric': 'LLM Rubric',
  };
  return labels[ct] || ct;
}

function deriveImpact(tc: TestCaseResult): string {
  if (tc.checkType === 'not-contains') return 'Potentially harmful misinformation could reach users';
  if (tc.checkType === 'contains' || tc.checkType === 'regex') return 'Users may receive incorrect factual information';
  return 'Users may not receive the guidance they need';
}

function enhanceGrading(gradingReason: string, passed: boolean, checkType: string, expected: string): string {
  if (gradingReason !== 'Assertion failed' && gradingReason !== 'Assertion passed') {
    return gradingReason;
  }
  const snippet = expected.length > 80 ? expected.slice(0, 80) + '…' : expected;
  if (checkType === 'not-contains') {
    return passed
      ? 'Response correctly does not contain the flagged text'
      : `Response contains text it should not: "${snippet}"`;
  }
  if (checkType === 'contains-all') {
    return passed
      ? 'Response contains all required items'
      : `Response is missing one or more required items from: "${snippet}"`;
  }
  return passed
    ? 'Response contains the expected text'
    : `Expected response to contain: "${snippet}"`;
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
      passed,
      total,
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
          expectedSummary: tc.expected.length > 120 ? tc.expected.slice(0, 120) + '…' : tc.expected,
          responseSummary: r.response.length > 180 ? r.response.slice(0, 180) + '…' : r.response,
          impact: deriveImpact(tc),
        });
      }
    }
  }

  const hasCritical = criticalFailures.length > 0;
  const bestPassRate = providers.length > 0 ? Math.max(...providers.map(p => p.passRate)) : 0;
  let readinessClass: string;
  let readinessLabel: string;
  let readinessExplanation: string;
  let nextSteps: string[];

  if (hasCritical) {
    readinessClass = 'not-ready';
    readinessLabel = 'Not Ready for Deployment';
    readinessExplanation = `There ${criticalFailures.length === 1 ? 'is' : 'are'} ${criticalFailures.length} critical failure${criticalFailures.length > 1 ? 's' : ''} that could directly harm users. The system must not be deployed until these are resolved.`;
    nextSteps = [
      'Review each critical failure below and identify the root cause',
      'Update the system prompt or knowledge base to address the gaps',
      'Re-run the evaluation to confirm the fixes',
      'Escalate to technical staff if the issue requires model or retrieval changes',
    ];
  } else if (bestPassRate < 80) {
    readinessClass = 'caution';
    readinessLabel = 'Needs Improvement';
    readinessExplanation = `No critical failures were found, but the overall pass rate (${bestPassRate}%) is below the 80% threshold. The system needs tuning before deployment.`;
    nextSteps = [
      'Open the Analysis tab to identify which dimensions are weakest',
      'Open the Details tab to review individual failing test cases',
      'Update the system prompt with more specific guidance for the failing areas',
      'Consider retrieval-augmented generation if facts are consistently wrong',
      'Re-run the evaluation after making changes',
    ];
  } else {
    readinessClass = 'ready';
    readinessLabel = 'Ready for Deployment';
    readinessExplanation = `All critical test cases passed and the overall pass rate is ${bestPassRate}%. The system meets the evaluation threshold for deployment.`;
    nextSteps = [
      'Share this report with stakeholders as a record of due diligence',
      'Schedule periodic re-evaluation as policies or underlying data change',
      'Monitor for user feedback that may reveal new failure modes',
      'Expand the test suite to cover additional edge cases over time',
    ];
  }

  // Dimensions — inferred from check type
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
      passedCount: d.passed,
      totalCount: d.total,
      barColor: rate >= 80 ? 'green' : rate >= 60 ? 'yellow' : 'red',
    };
  });

  let patternNote = '';
  if (dimensions.length > 0) {
    const lowest = dimensions.reduce((a, b) => a.passRate < b.passRate ? a : b);
    if (lowest.passRate < 80) {
      patternNote = `Weakest area: <strong>${esc(lowest.name)}</strong> (${lowest.passedCount}/${lowest.totalCount} tests passing). Focus system prompt improvements here first, then re-run the evaluation.`;
    }
  }

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

  const failedCaseCount = input.testCases.filter(tc => tc.results.some(r => !r.passed)).length;
  const criticalCaseCount = input.testCases.filter(tc => tc.severity === 'critical').length;

  const testCases: TestCaseView[] = input.testCases.map(tc => {
    const anyFailed = tc.results.some(r => !r.passed);
    return {
      number: tc.number,
      question: tc.question,
      severity: tc.severity,
      checkType: tc.checkType,
      checkTypeLabel: checkTypeLabel(tc.checkType),
      expected: tc.expected,
      anyFailed,
      colspan: 4 + input.providers.length + 1,
      results: tc.results.map(r => ({
        providerName: r.provider,
        resultClass: r.passed ? 'result-pass' : 'result-fail',
        resultLabel: r.passed ? 'PASS' : 'FAIL',
        response: r.response,
        enhancedGradingReason: enhanceGrading(r.gradingReason, r.passed, tc.checkType, tc.expected),
      })),
    };
  });

  return {
    title: input.title,
    date: input.date,
    testCaseCount: input.testCases.length,
    failedCaseCount,
    criticalCaseCount,
    providerList: input.providers.join(', '),
    readinessClass,
    readinessLabel,
    readinessExplanation,
    nextSteps,
    criticalFailureCount: criticalFailures.length,
    hasCriticalFailures: hasCritical,
    multipleProviders: input.providers.length > 1,
    testSource: input.testSource,
    gradingMethods: [...new Set(input.testCases.map(tc => checkTypeLabel(tc.checkType)))].join(', '),
    generatedAt: new Date().toISOString(),
    providers,
    criticalFailures,
    dimensions,
    patternNote,
    severities,
    testCases,
  };
}

// ---------- HTML Rendering ----------

function renderHtml(data: ReportData): string {
  // ── Summary tab ──────────────────────────────────────────────────────────

  const nextStepsHtml = data.nextSteps.map(s => `<li>${s}</li>`).join('');

  const providerStatCardsHtml = data.providers.map(p => `
    <div class="stat-card">
      <div class="stat-value ${p.passRateClass}">${p.passRate}%</div>
      <div class="stat-fraction">${p.passed} of ${p.total} tests</div>
      <div class="stat-label">${esc(p.name)}</div>
    </div>
  `).join('');

  const criticalCardHtml = `
    <div class="stat-card">
      <div class="stat-value ${data.criticalFailureCount > 0 ? 'fail' : 'pass'}">${data.criticalFailureCount}</div>
      <div class="stat-fraction">${data.criticalCaseCount} critical tests run</div>
      <div class="stat-label">Critical failures</div>
    </div>
    <div class="stat-card">
      <div class="stat-value neutral">${data.testCaseCount}</div>
      <div class="stat-fraction">${data.failedCaseCount} failed, ${data.testCaseCount - data.failedCaseCount} passed</div>
      <div class="stat-label">Total test cases</div>
    </div>
  `;

  const criticalFailuresHtml = data.hasCriticalFailures ? `
    <div class="card">
      <h2 class="card-title">
        <span class="card-title-icon cf-icon">!</span>
        Critical Failures — Require Resolution Before Deployment
      </h2>
      ${data.criticalFailures.map(cf => `
        <div class="critical-failure">
          <div class="cf-header">
            <span class="cf-num">#${cf.testNumber}</span>
            <span class="cf-question">${esc(cf.question)}</span>
            <span class="cf-provider">${esc(cf.provider)}</span>
          </div>
          <div class="cf-comparison">
            <div class="cf-col">
              <div class="cf-col-label">Expected</div>
              <div class="cf-col-value expected">${esc(cf.expectedSummary)}</div>
            </div>
            <div class="cf-col">
              <div class="cf-col-label">Actual response</div>
              <div class="cf-col-value actual">${esc(cf.responseSummary)}</div>
            </div>
          </div>
          <div class="cf-impact">⚠ ${esc(cf.impact)}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  // ── Analysis tab ──────────────────────────────────────────────────────────

  const dimensionBarsHtml = data.dimensions.map(d => `
    <div class="bar-row">
      <div class="bar-meta">
        <span class="bar-label">${esc(d.name)}</span>
        <span class="bar-count">${d.passedCount}/${d.totalCount} tests</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${d.barColor}" style="width: ${d.passRate}%"></div>
      </div>
      <span class="bar-pct">${d.passRate}%</span>
    </div>
  `).join('');

  const patternHtml = data.patternNote
    ? `<div class="pattern-note">${data.patternNote}</div>`
    : '';

  const severityProviderHeaders = data.providers.map(p =>
    `<th>${esc(p.name.split(':').pop() || p.name)}</th>`
  ).join('');

  const severityRowsHtml = data.severities.map(s => {
    const cells = s.results.map(r => {
      const pct = s.total > 0 ? Math.round((r.passed / r.total) * 100) : 0;
      const color = pct === 100 ? 'pass' : pct >= 50 ? 'neutral' : 'fail';
      return `
        <td>
          <div class="sev-cell">
            <div class="sev-bar-track">
              <div class="sev-bar-fill ${color}" style="width:${pct}%"></div>
            </div>
            <span class="sev-cell-text">${r.passed}/${r.total}</span>
          </div>
        </td>`;
    }).join('');
    return `
      <tr class="sev-row" data-sev="${s.level}" onclick="gotoSeverity('${s.level}')">
        <td><span class="usa-tag severity-badge ${s.level}">${s.level}</span></td>
        <td class="sev-total">${s.total}</td>
        ${cells}
        <td class="sev-link">View →</td>
      </tr>`;
  }).join('');

  const comparisonHtml = data.multipleProviders ? `
    <div class="card">
      <h2 class="card-title">Provider Comparison</h2>
      <table class="data-table usa-table usa-table--borderless usa-table--compact">
        <thead>
          <tr>
            <th>Metric</th>
            ${data.providers.map(p => `<th>${esc(p.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pass rate</td>
            ${data.providers.map(p => `<td><strong class="${p.passRateClass}">${p.passRate}%</strong> <span class="dimtext">(${p.passed}/${p.total})</span></td>`).join('')}
          </tr>
          <tr>
            <td>Critical failures</td>
            ${data.providers.map(p => `<td class="${p.criticalFailures > 0 ? 'fail' : 'pass'}">${p.criticalFailures}</td>`).join('')}
          </tr>
          ${data.severities.map(s => `
          <tr>
            <td><span class="usa-tag severity-badge ${s.level}">${s.level}</span> severity</td>
            ${s.results.map(r => {
              const pct = r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0;
              return `<td>${r.passed}/${r.total} <span class="dimtext">(${pct}%)</span></td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  // ── Details tab ──────────────────────────────────────────────────────────

  const providerHeaders = data.providers.map(p =>
    `<th>${esc(p.name.split(':').pop() || p.name)}</th>`
  ).join('');

  const detailRowsHtml = data.testCases.map(tc => {
    const resultCells = tc.results.map(r =>
      `<td class="${r.resultClass}">${r.resultLabel}</td>`
    ).join('');

    const expandedContent = tc.results.map(r => `
      <div class="expanded-provider">
        <div class="exp-provider-name">${esc(r.providerName)}</div>
        <div class="exp-cols">
          <div class="exp-col">
            <div class="exp-label">Response</div>
            <div class="exp-response">${esc(r.response)}</div>
          </div>
          <div class="exp-col exp-grading">
            <div class="exp-label">Grading</div>
            <div class="exp-reason ${r.resultClass}">${esc(r.enhancedGradingReason)}</div>
          </div>
        </div>
      </div>
    `).join('');

    return `
      <tbody class="test-case-group" data-severity="${tc.severity}" data-passed="${!tc.anyFailed}" onclick="toggleRow(${tc.number})">
        <tr class="main-row ${tc.anyFailed ? 'fail-row' : 'pass-row'}">
          <td class="tc-num">${tc.number}</td>
          <td class="tc-question">${esc(tc.question)}</td>
          <td><span class="usa-tag severity-badge ${tc.severity}">${tc.severity}</span></td>
          <td class="tc-check"><span class="check-badge">${esc(tc.checkTypeLabel)}</span></td>
          ${resultCells}
          <td class="tc-chevron"><span class="chevron" id="chevron-${tc.number}">▼</span></td>
        </tr>
        <tr class="detail-row">
          <td colspan="${tc.colspan}">
            <div class="expanded-detail" id="detail-${tc.number}">
              <div class="exp-expected">
                <span class="exp-label">Expected</span>
                <span class="exp-expected-value">${esc(tc.expected)}</span>
              </div>
              ${expandedContent}
            </div>
          </td>
        </tr>
      </tbody>`;
  }).join('');

  const failedCount = data.testCases.filter(tc => tc.anyFailed).length;

  // ── Full HTML ──────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(data.title)} — Evergreen Eval Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://designsystem.digital.gov/assets/css/uswds.min.css">
<style>
/* ── Reset & Tokens (USWDS-aligned) ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:           #f0f0f0;
  --surface:      #ffffff;
  --border:       #dfe1e2;
  --border-sub:   #f0f0f0;
  --text:         #1b1b1b;
  --text-2:       #3d4551;
  --text-3:       #71767a;
  --brand:        #005ea2;
  --pass:         #00a91c;
  --pass-bg:      #ecf3ec;
  --pass-border:  #70e17b;
  --fail:         #e52207;
  --fail-bg:      #fff3f2;
  --fail-border:  #f4a8a0;
  --warn:         #e5a000;
  --warn-bg:      #faf3d1;
  --warn-border:  #fee685;
  --neutral:      #1b1b1b;
  --font:         'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif;
  --mono:         'Source Code Pro', 'Courier New', monospace;
  --radius:       4px;
  --shadow:       0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05);
  --shadow-md:    0 4px 12px rgba(0,0,0,.10);
}

/* ── Base ── */
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  font-size: 15px;
}

/* ── Header ── */
.report-header {
  background: linear-gradient(135deg, #112e51 0%, #205493 100%);
  color: #fff;
  padding: 32px 40px 28px;
  position: relative;
  overflow: hidden;
}
.report-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,.06) 1px, transparent 0);
  background-size: 28px 28px;
  pointer-events: none;
}
.header-inner { position: relative; }
.report-header h1 {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}
.report-header .meta {
  font-size: 13px;
  color: #94a3b8;
  display: flex;
  gap: 0;
  flex-wrap: wrap;
}
.report-header .meta span + span::before { content: "·"; margin: 0 10px; color: #475569; }
.readiness-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-top: 14px;
}
.readiness-pill.ready    { background: rgba(0,169,28,.25);  color: #a8f0b0; border: 1px solid rgba(0,169,28,.4); }
.readiness-pill.not-ready{ background: rgba(229,34,7,.25);  color: #f4a8a0; border: 1px solid rgba(229,34,7,.4); }
.readiness-pill.caution  { background: rgba(229,160,0,.25); color: #fee685; border: 1px solid rgba(229,160,0,.4); }

/* ── Tab nav ── */
.tab-nav {
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 40px;
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: var(--shadow);
}
.tab-btn {
  padding: 14px 22px;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  transition: color .15s, border-color .15s;
  line-height: 1.3;
  text-align: left;
}
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--text); border-bottom-color: var(--brand); font-weight: 700; }
.tab-btn .tab-label { display: block; }
.tab-btn .tab-sub { display: block; font-size: 11px; font-weight: 400; color: var(--text-3); margin-top: 2px; }
.tab-btn.active .tab-sub { color: var(--text-2); }

/* ── Tab content ── */
.tab-content { display: none; padding: 32px 40px 60px; max-width: 1140px; }
.tab-content.active { display: block; }

/* ── Cards ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px 28px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
}
.card-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-2);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.cf-icon { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail-border); }

/* ── Readiness hero card ── */
.readiness-hero {
  border-radius: var(--radius);
  padding: 28px 32px;
  margin-bottom: 20px;
  border-width: 1px;
  border-style: solid;
  box-shadow: var(--shadow-md);
}
.readiness-hero.ready    { background: var(--pass-bg); border-color: var(--pass-border); }
.readiness-hero.not-ready{ background: var(--fail-bg); border-color: var(--fail-border); }
.readiness-hero.caution  { background: var(--warn-bg); border-color: var(--warn-border); }
.rh-status {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 8px;
}
.rh-status.ready    { color: var(--pass); }
.rh-status.not-ready{ color: var(--fail); }
.rh-status.caution  { color: var(--warn); }
.rh-explanation {
  font-size: 15px;
  color: var(--text);
  margin-bottom: 20px;
  line-height: 1.6;
}
.rh-next-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-2);
  margin-bottom: 10px;
}
.rh-steps {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rh-steps li {
  font-size: 14px;
  color: var(--text);
  padding-left: 20px;
  position: relative;
}
.rh-steps li::before {
  content: '→';
  position: absolute;
  left: 0;
  color: var(--text-3);
  font-weight: 600;
}

/* ── Stat cards ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 22px;
  box-shadow: var(--shadow);
}
.stat-value {
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -1px;
  line-height: 1;
}
.stat-value.pass    { color: var(--pass); }
.stat-value.fail    { color: var(--fail); }
.stat-value.neutral { color: var(--neutral); }
.stat-fraction {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
  font-weight: 500;
}
.stat-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-2);
  margin-top: 8px;
}

/* ── Critical failures ── */
.critical-failure {
  border-left: 3px solid var(--fail);
  background: #fff;
  border-radius: 0 6px 6px 0;
  padding: 16px 20px;
  margin-bottom: 14px;
  box-shadow: var(--shadow);
}
.critical-failure:last-child { margin-bottom: 0; }
.cf-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.cf-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  background: var(--border-sub);
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
}
.cf-question {
  font-weight: 600;
  font-size: 14px;
  flex: 1;
}
.cf-provider {
  font-size: 12px;
  color: var(--text-3);
  flex-shrink: 0;
}
.cf-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 10px;
}
@media (max-width: 680px) { .cf-comparison { grid-template-columns: 1fr; } }
.cf-col-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-3);
  margin-bottom: 5px;
}
.cf-col-value {
  font-family: var(--mono);
  font-size: 12px;
  padding: 10px 12px;
  border-radius: 5px;
  line-height: 1.5;
}
.cf-col-value.expected { background: var(--pass-bg); border: 1px solid var(--pass-border); color: #166534; }
.cf-col-value.actual   { background: var(--fail-bg); border: 1px solid var(--fail-border); color: #7f1d1d; }
.cf-impact {
  font-size: 12px;
  font-weight: 600;
  color: var(--fail);
  padding: 6px 10px;
  background: var(--fail-bg);
  border-radius: 4px;
  display: inline-block;
}

/* ── Analysis: dimension bars ── */
.bar-chart { display: flex; flex-direction: column; gap: 14px; margin-top: 4px; }
.bar-row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 12px; }
.bar-meta { display: flex; flex-direction: column; min-width: 0; }
.bar-label { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-count { font-size: 11px; color: var(--text-3); font-weight: 500; margin-top: 1px; }
.bar-track { flex: none; width: 300px; height: 22px; background: var(--border-sub); border-radius: 4px; overflow: hidden; }
@media (max-width: 700px) { .bar-track { width: 160px; } }
.bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(.16,1,.3,1); }
.bar-fill.green  { background: linear-gradient(90deg, #16a34a, #22c55e); }
.bar-fill.yellow { background: linear-gradient(90deg, #d97706, #fbbf24); }
.bar-fill.red    { background: linear-gradient(90deg, #dc2626, #f87171); }
.bar-pct { font-size: 14px; font-weight: 700; color: var(--text); width: 40px; text-align: right; }
.pattern-note {
  margin-top: 18px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  padding: 14px 18px;
  font-size: 14px;
  color: #3730a3;
  line-height: 1.5;
}

/* ── USWDS overrides for report data tables and buttons ── */
/* Ensure custom table styles win over USWDS defaults */
table.data-table, table.detail-table {
  font-family: var(--font);
  font-size: 13px;
}
/* Keep filter buttons compact; USWDS adds extra padding by default */
.filter-bar .usa-button {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  height: auto;
}

/* ── Analysis: severity table ── */
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--text-3);
  background: var(--bg);
  border-bottom: 2px solid var(--border);
}
.data-table td { padding: 12px 14px; border-bottom: 1px solid var(--border-sub); font-size: 13px; vertical-align: middle; }
.data-table tbody tr:last-child td { border-bottom: none; }
.sev-row { cursor: pointer; transition: background .12s; }
.sev-row:hover { background: var(--bg); }
.sev-row:hover .sev-link { opacity: 1; }
.sev-total { font-weight: 600; color: var(--text-2); }
.sev-link { font-size: 12px; font-weight: 600; color: var(--brand); opacity: 0; transition: opacity .15s; }
.sev-cell { display: flex; align-items: center; gap: 8px; }
.sev-bar-track { width: 80px; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; flex-shrink: 0; }
.sev-bar-fill { height: 100%; border-radius: 4px; }
.sev-bar-fill.pass    { background: var(--pass); }
.sev-bar-fill.neutral { background: var(--warn); }
.sev-bar-fill.fail    { background: var(--fail); }
.sev-cell-text { font-weight: 600; font-size: 13px; color: var(--text); }
.dimtext { color: var(--text-3); font-weight: 400; font-size: 12px; }

/* ── Severity & check badges ── */
/* Override usa-tag defaults so custom sev colors take precedence */
.severity-badge.usa-tag {
  text-transform: lowercase;
  letter-spacing: normal;
  font-weight: 600;
}
.severity-badge {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.severity-badge.critical { background: #fee2e2; color: #991b1b; }
.severity-badge.high     { background: #fef9c3; color: #854d0e; }
.severity-badge.medium   { background: #dbeafe; color: #1e40af; }
.severity-badge.low      { background: #f1f5f9; color: #475569; }
.check-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: var(--border-sub);
  color: var(--text-2);
  white-space: nowrap;
}

/* ── Details: filter bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.filter-label { font-size: 12px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.6px; margin-right: 4px; }
.filter-btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  transition: all .15s;
}
.filter-btn:hover { border-color: var(--brand); color: var(--brand); }
.filter-btn.active { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: 600; }
.filter-btn .filter-count {
  background: rgba(255,255,255,.25);
  border-radius: 10px;
  padding: 0 5px;
  font-size: 11px;
  margin-left: 4px;
}
.filter-btn:not(.active) .filter-count { background: var(--border-sub); color: var(--text-3); }
.filter-result { font-size: 13px; color: var(--text-3); margin-left: auto; }

/* ── Details: table ── */
.detail-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); }
.detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.detail-table th {
  padding: 11px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--text-3);
  background: var(--bg);
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 53px;
  z-index: 5;
}
.detail-table td { padding: 12px 14px; border-bottom: 1px solid var(--border-sub); vertical-align: middle; }
.test-case-group { cursor: pointer; }
.test-case-group:hover .main-row { background: #f8faff; }
.main-row.fail-row { background: #fff8f8; }
.main-row.fail-row:hover, .test-case-group:hover .main-row.fail-row { background: #fff0f0; }
.tc-num { font-size: 12px; color: var(--text-3); font-weight: 600; white-space: nowrap; }
.tc-question { font-weight: 500; max-width: 360px; line-height: 1.4; }
.tc-check { white-space: nowrap; }
.result-pass { color: var(--pass); font-weight: 700; font-size: 12px; letter-spacing: 0.5px; }
.result-fail { color: var(--fail); font-weight: 700; font-size: 12px; letter-spacing: 0.5px; }
.tc-chevron { text-align: center; width: 36px; }
.chevron {
  display: inline-block;
  font-size: 10px;
  color: var(--text-3);
  transition: transform .2s;
  user-select: none;
}
.chevron.open { transform: rotate(180deg); }

/* ── Details: expanded rows ── */
.detail-row td { padding: 0; border-bottom: 1px solid var(--border-sub); }
.expanded-detail {
  display: none;
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid var(--border);
}
.expanded-detail.open { display: block; }
.exp-expected {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 14px;
  background: var(--pass-bg);
  border: 1px solid var(--pass-border);
  border-radius: 6px;
}
.exp-expected .exp-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #166534;
  white-space: nowrap;
  flex-shrink: 0;
}
.exp-expected-value { font-family: var(--mono); font-size: 12px; color: #166534; line-height: 1.5; }
.expanded-provider {
  margin-bottom: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.expanded-provider:last-child { margin-bottom: 0; }
.exp-provider-name {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--text-3);
  padding: 8px 14px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.exp-cols {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0;
}
@media (max-width: 700px) { .exp-cols { grid-template-columns: 1fr; } }
.exp-col { padding: 12px 14px; }
.exp-col + .exp-col { border-left: 1px solid var(--border); }
.exp-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-3);
  margin-bottom: 6px;
}
.exp-response {
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 220px;
  overflow-y: auto;
  color: var(--text);
}
.exp-grading { min-width: 280px; max-width: 340px; }
.exp-reason {
  font-size: 13px;
  line-height: 1.5;
  padding: 8px 10px;
  border-radius: 5px;
}
.exp-reason.result-pass { background: var(--pass-bg); color: #166534; font-weight: 500; }
.exp-reason.result-fail { background: var(--fail-bg); color: #7f1d1d; font-weight: 500; }

/* ── Footer ── */
.methodology {
  padding: 24px 40px 40px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
}
.methodology span strong { color: var(--text-2); font-weight: 600; }
.pass   { color: var(--pass); }
.fail   { color: var(--fail); }
.neutral{ color: var(--neutral); }

/* ── Print ── */
@media print {
  .tab-nav { position: static; box-shadow: none; }
  .tab-content { display: block !important; page-break-before: always; padding: 20px; }
  .tab-content:first-of-type { page-break-before: auto; }
  .filter-bar { display: none; }
  .expanded-detail { display: block !important; }
  .chevron { display: none; }
  .sev-link { display: none; }
}
</style>
</head>
<body>

<!-- USWDS Government Banner -->
<section class="usa-banner" aria-label="Official website of the United States government">
  <div class="usa-accordion">
    <header class="usa-banner__header">
      <div class="usa-banner__inner">
        <div class="grid-col-auto">
          <img class="usa-banner__header-flag" src="https://designsystem.digital.gov/assets/img/us_flag_small.png" alt="U.S. flag">
        </div>
        <div class="grid-col-fill tablet:grid-col-auto" aria-hidden="true">
          <p class="usa-banner__header-text">An official website of the United States government</p>
          <p class="usa-banner__header-action">Here's how you know</p>
        </div>
        <button type="button" class="usa-accordion__button usa-banner__button" aria-expanded="false" aria-controls="gov-banner-report">
          <span class="usa-banner__button-text">Here's how you know</span>
        </button>
      </div>
    </header>
    <div class="usa-banner__content usa-accordion__content" id="gov-banner-report" hidden>
      <div class="grid-row grid-gap-lg">
        <div class="usa-banner__guidance tablet:grid-col-6">
          <img class="usa-banner__icon usa-media-block__img" src="https://designsystem.digital.gov/assets/img/icon-dot-gov.svg" alt="">
          <div class="usa-media-block__body">
            <p><strong>Official websites use .gov</strong><br>A <strong>.gov</strong> website belongs to an official government organization in the United States.</p>
          </div>
        </div>
        <div class="usa-banner__guidance tablet:grid-col-6">
          <img class="usa-banner__icon usa-media-block__img" src="https://designsystem.digital.gov/assets/img/icon-https.svg" alt="">
          <div class="usa-media-block__body">
            <p><strong>Secure .gov websites use HTTPS</strong><br>A <strong>lock</strong> or <strong>https://</strong> means you've safely connected to the .gov website.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Back link bar -->
<div style="background:#112e51;padding:6px 0;font-size:0.8125rem;">
  <div class="grid-container">
    <a href="/" class="usa-link" style="color:#dce4ef;">← New Evaluation</a>
  </div>
</div>

<!-- USWDS accordion JS (banner only) -->
<script src="https://designsystem.digital.gov/assets/js/uswds.min.js"></script>

<!-- ── Header ── -->
<header class="report-header">
  <div class="header-inner">
    <h1>${esc(data.title)}</h1>
    <div class="meta">
      <span>${esc(data.date)}</span>
      <span>${data.testCaseCount} test cases</span>
      <span>${esc(data.providerList)}</span>
      <span>${esc(data.testSource)}</span>
    </div>
    <div class="readiness-pill ${data.readinessClass}">${esc(data.readinessLabel)}</div>
  </div>
</header>

<!-- ── Tab nav ── -->
<nav class="tab-nav">
  <button class="tab-btn active" data-tab="summary">
    <span class="tab-label">Summary</span>
    <span class="tab-sub">Policy &amp; Leadership</span>
  </button>
  <button class="tab-btn" data-tab="analysis">
    <span class="tab-label">Analysis</span>
    <span class="tab-sub">Operations</span>
  </button>
  <button class="tab-btn" data-tab="details">
    <span class="tab-label">Details</span>
    <span class="tab-sub">Technical</span>
  </button>
</nav>

<!-- ── Summary tab ── -->
<section class="tab-content active" id="tab-summary">

  <div class="readiness-hero ${data.readinessClass}">
    <div class="rh-status ${data.readinessClass}">${esc(data.readinessLabel)}</div>
    <p class="rh-explanation">${esc(data.readinessExplanation)}</p>
    <div class="rh-next-label">What to do next</div>
    <ul class="rh-steps">${nextStepsHtml}</ul>
  </div>

  <div class="stats-grid">
    ${providerStatCardsHtml}
    ${criticalCardHtml}
  </div>

  ${criticalFailuresHtml}

</section>

<!-- ── Analysis tab ── -->
<section class="tab-content" id="tab-analysis">

  <div class="card">
    <h2 class="card-title">Results by Evaluation Dimension</h2>
    <div class="bar-chart">${dimensionBarsHtml}</div>
    ${patternHtml}
  </div>

  <div class="card">
    <h2 class="card-title">Results by Severity — click a row to view those test cases</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Severity</th>
          <th>Tests</th>
          ${severityProviderHeaders}
          <th></th>
        </tr>
      </thead>
      <tbody>${severityRowsHtml}</tbody>
    </table>
  </div>

  ${comparisonHtml}

</section>

<!-- ── Details tab ── -->
<section class="tab-content" id="tab-details">

  <div class="filter-bar">
    <span class="filter-label">Show</span>
    <button class="usa-button filter-btn active" data-filter="all" onclick="applyFilter('all')">
      All <span class="filter-count">${data.testCaseCount}</span>
    </button>
    <button class="usa-button usa-button--outline filter-btn" data-filter="failures" onclick="applyFilter('failures')">
      Failures <span class="filter-count">${failedCount}</span>
    </button>
    <button class="usa-button usa-button--outline filter-btn" data-filter="critical" onclick="applyFilter('critical')">
      Critical <span class="filter-count">${data.criticalCaseCount}</span>
    </button>
    <span class="filter-result" id="filter-result"></span>
  </div>

  <div class="detail-card">
    <table class="detail-table usa-table usa-table--borderless usa-table--compact">
      <thead>
        <tr>
          <th>#</th>
          <th>Question</th>
          <th>Severity</th>
          <th>Check</th>
          ${providerHeaders}
          <th></th>
        </tr>
      </thead>
      ${detailRowsHtml}
    </table>
  </div>

</section>

<!-- ── Footer ── -->
<footer class="methodology">
  <span><strong>Framework:</strong> Evergreen 4-Dimension Eval</span>
  <span><strong>Test Source:</strong> ${esc(data.testSource)}</span>
  <span><strong>Grading:</strong> ${esc(data.gradingMethods)}</span>
  <span><strong>Generated:</strong> ${esc(data.generatedAt)}</span>
</footer>

<script>
(function() {
  // ── Tab switching ──
  function activateTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.tab-content').forEach(function(c) {
      c.classList.toggle('active', c.id === 'tab-' + name);
    });
  }
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { activateTab(btn.dataset.tab); });
  });

  // ── Row expand/collapse ──
  function toggleRow(num) {
    var detail = document.getElementById('detail-' + num);
    var chevron = document.getElementById('chevron-' + num);
    if (!detail) return;
    var isOpen = detail.classList.toggle('open');
    if (chevron) chevron.classList.toggle('open', isOpen);
  }
  window.toggleRow = toggleRow;

  // Stop click inside expanded detail from collapsing the row
  document.querySelectorAll('.expanded-detail').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); });
  });

  // ── Details filter ──
  var currentFilter = 'all';
  function applyFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      var isActive = btn.dataset.filter === filter;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('usa-button--outline', !isActive);
    });
    var total = 0, visible = 0;
    document.querySelectorAll('.test-case-group').forEach(function(group) {
      total++;
      var sev = group.dataset.severity;
      var passed = group.dataset.passed === 'true';
      var show = true;
      if (filter === 'failures' && passed) show = false;
      if (filter === 'critical' && sev !== 'critical') show = false;
      group.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    var resultEl = document.getElementById('filter-result');
    if (resultEl) {
      resultEl.textContent = visible === total ? '' : (visible + ' of ' + total + ' shown');
    }
  }
  window.applyFilter = applyFilter;

  // ── Severity row click → Details tab with filter ──
  function gotoSeverity(sev) {
    activateTab('details');
    if (sev === 'critical') {
      applyFilter('critical');
    } else {
      applyFilter('all');
    }
  }
  window.gotoSeverity = gotoSeverity;

})();
</script>

<!-- USWDS Footer -->
<footer class="usa-footer usa-footer--slim">
  <div class="usa-footer__secondary-section">
    <div class="grid-container">
      <div class="grid-row grid-gap">
        <div class="usa-footer__logo grid-row mobile-lg:grid-col-6 mobile-lg:grid-gap-2">
          <div class="mobile-lg:grid-col-auto">
            <p class="usa-footer__logo-heading">Evergreen</p>
          </div>
        </div>
        <div class="usa-footer__contact-links mobile-lg:grid-col-6">
          <p style="font-size:0.8125rem; color:#565c65; margin:0">
            Powered by <a href="https://www.promptfoo.dev" class="usa-link">Promptfoo</a> under the Apache 2.0 License
          </p>
        </div>
      </div>
    </div>
  </div>
</footer>
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
