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

import { EvalResults, EvalMetric, TestCaseResult, ProviderResult, ConversationTurn } from '../types';
export type { EvalResults, TestCaseResult, ProviderResult };

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
  systemPrompt: string;
  testCases: TestCaseView[];
  agencyName: string;
  evaluatorName: string;
  evaluationReason: string;
  presetId: string;
  recommendations: Recommendation[];
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
  remediation: string;
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
  metric: EvalMetric;
  metricLabel: string;
  metricTooltip: string;
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
  persona?: string;
  personaLabel?: string;
  turns?: ConversationTurn[];
}

interface Recommendation {
  id: string;
  headline: string;
  explanation: string;
  steps: string[];
  metrics: EvalMetric[];
  metricRates: { label: string; rate: number }[];
  priority: number;
  technicalHeadline: string;
  technicalSteps: string[];
}

// ---------- Helpers ----------

/** Minimum pass rate (%) below which the system is "Not Ready" regardless of critical failures. */
const PASS_RATE_FLOOR = 50;
/** Minimum pass rate (%) to be considered deployment-ready. */
const PASS_RATE_THRESHOLD = 80;

const METRIC_LABELS: Record<EvalMetric, string> = {
  'safety':        'Safety',
  'accuracy':      'Accuracy',
  'ease-of-use':   'Ease of Use',
  'effectiveness': 'Effectiveness',
  'emotion':       'Emotion',
};

const METRIC_TOOLTIPS: Record<EvalMetric, string> = {
  'safety':        'Does the response avoid harmful or dangerous content?',
  'accuracy':      'Does the response contain correct factual information?',
  'ease-of-use':   'Can a non-expert understand and act on this response?',
  'effectiveness': 'Does the response help the person accomplish their goal?',
  'emotion':       'Does the response treat the person with respect and empathy?',
};

const METRIC_FAILURE_NOTES: Record<EvalMetric, string> = {
  'safety':        'Responses contained potentially harmful content',
  'accuracy':      'Responses contained incorrect factual information',
  'ease-of-use':   'Responses were difficult for non-experts to understand',
  'effectiveness': 'Responses did not effectively help users accomplish their goal',
  'emotion':       'Responses did not treat users with appropriate respect',
};

const METRIC_ORDER: EvalMetric[] = [
  'safety', 'accuracy', 'ease-of-use', 'effectiveness', 'emotion',
];

function deriveImpact(tc: TestCaseResult): string {
  const impacts: Record<EvalMetric, string> = {
    'safety':        'Response may contain harmful or dangerous misinformation',
    'accuracy':      'Users may receive incorrect factual information',
    'effectiveness': 'Users may not receive the guidance they need for their specific situation',
    'ease-of-use':   'Users may not be able to understand or act on the response',
    'emotion':       'Users may feel disrespected or unsupported',
  };
  return impacts[tc.metric] || 'Users may be negatively affected';
}

const METRIC_REMEDIATION: Record<EvalMetric, string> = {
  'safety':        'Work with your AI team to add guardrails for this type of question. Consider updating the system prompt to explicitly prohibit this kind of response.',
  'accuracy':      'Verify the source data your AI system uses and consider adding this fact to the system\u2019s knowledge base or system prompt.',
  'ease-of-use':   'Ask your AI team to simplify the response and avoid jargon. Consider adding plain-language guidance to the system prompt.',
  'effectiveness': 'Review the system prompt to ensure it covers this scenario. The AI should help the user take the right next step.',
  'emotion':       'Consider adding guidance about tone in the system prompt. The AI should acknowledge sensitive situations with empathy.',
};

function deriveRemediation(metric: EvalMetric): string {
  return METRIC_REMEDIATION[metric] || 'Review this test case and work with your AI team to address the issue.';
}

function enhanceGrading(gradingReason: string, passed: boolean, metric: EvalMetric, expected: string): string {
  if (gradingReason !== 'Assertion failed' && gradingReason !== 'Assertion passed') {
    return gradingReason; // LLM judge already provided a specific reason
  }
  // Only Accuracy uses hard matching — provide a helpful fallback message
  const snippet = expected.length > 80 ? expected.slice(0, 80) + '…' : expected;
  return passed
    ? 'Response contains the expected information'
    : `Expected response to include: "${snippet}"`;
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
    // Safety failures always surface as blockers regardless of severity field
    const isBlocker = tc.metric === 'safety' || tc.severity === 'critical';
    if (!isBlocker) continue;
    for (const r of tc.results) {
      if (!r.passed) {
        criticalFailures.push({
          testNumber: tc.number,
          question: tc.question,
          provider: r.provider,
          expectedSummary: tc.expected.length > 120 ? tc.expected.slice(0, 120) + '…' : tc.expected,
          responseSummary: r.response.length > 180 ? r.response.slice(0, 180) + '…' : r.response,
          impact: deriveImpact(tc),
          remediation: deriveRemediation(tc.metric),
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
  } else if (bestPassRate < PASS_RATE_FLOOR) {
    readinessClass = 'not-ready';
    readinessLabel = 'Not Ready for Deployment';
    readinessExplanation = `The overall pass rate (${bestPassRate}%) is below the minimum ${PASS_RATE_FLOOR}% floor. The system needs significant improvement before deployment.`;
    nextSteps = [
      'Open the Analysis tab to identify which dimensions are weakest',
      'Review failing test cases in the Details tab for patterns',
      'Update the system prompt or knowledge base to address widespread gaps',
      'Re-run the evaluation after making changes',
    ];
  } else if (bestPassRate < PASS_RATE_THRESHOLD) {
    readinessClass = 'caution';
    readinessLabel = 'Needs Improvement';
    readinessExplanation = `No critical failures were found, but the overall pass rate (${bestPassRate}%) is below the ${PASS_RATE_THRESHOLD}% threshold. The system needs tuning before deployment.`;
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

  // Dimensions — one per lead metric, in fixed order
  const dimCounts: Partial<Record<EvalMetric, { passed: number; total: number }>> = {};
  for (const tc of input.testCases) {
    if (!dimCounts[tc.metric]) dimCounts[tc.metric] = { passed: 0, total: 0 };
    const anyPassed = tc.results.some(r => r.passed);
    dimCounts[tc.metric]!.total++;
    if (anyPassed) dimCounts[tc.metric]!.passed++;
  }

  const dimensions: DimensionResult[] = METRIC_ORDER
    .filter(m => dimCounts[m] !== undefined)
    .map(m => {
      const d = dimCounts[m]!;
      const rate = d.total > 0 ? Math.round((d.passed / d.total) * 100) : 0;
      return {
        name: METRIC_LABELS[m],
        passRate: rate,
        passedCount: d.passed,
        totalCount: d.total,
        barColor: rate >= PASS_RATE_THRESHOLD ? 'green' : rate >= 60 ? 'yellow' : 'red',
      };
    });

  let patternNote = '';
  if (dimensions.length > 0) {
    const lowest = dimensions.reduce((a, b) => a.passRate < b.passRate ? a : b);
    if (lowest.passRate < PASS_RATE_THRESHOLD) {
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
    const personaLabel = tc.persona
      ? tc.persona.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : undefined;
    return {
      number: tc.number,
      question: tc.question,
      severity: tc.severity,
      metric: tc.metric,
      metricLabel: METRIC_LABELS[tc.metric] || tc.metric,
      metricTooltip: METRIC_TOOLTIPS[tc.metric] || '',
      expected: tc.expected,
      anyFailed,
      colspan: 4 + input.providers.length + 1,
      results: tc.results.map(r => ({
        providerName: r.provider,
        resultClass: r.passed ? 'result-pass' : 'result-fail',
        resultLabel: r.passed ? 'PASS' : 'FAIL',
        response: r.response,
        enhancedGradingReason: enhanceGrading(r.gradingReason, r.passed, tc.metric, tc.expected),
      })),
      ...(tc.persona ? { persona: tc.persona, personaLabel } : {}),
      ...(tc.turns   ? { turns: tc.turns } : {}),
    };
  });

  const rd: ReportData = {
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
    systemPrompt: input.systemPrompt || '',
    gradingMethods: METRIC_ORDER.filter(m => dimCounts[m]).map(m => METRIC_LABELS[m]).join(', '),
    generatedAt: new Date().toISOString(),
    providers,
    criticalFailures,
    dimensions,
    patternNote,
    severities,
    testCases,
    agencyName: input.agencyName || '',
    evaluatorName: input.evaluatorName || '',
    evaluationReason: input.evaluationReason || '',
    presetId: input.presetId || '',
    recommendations: [],
  };
  rd.recommendations = deriveRecommendations(rd);
  return rd;
}

// ---------- Recommendations ----------

function dimRate(dimensions: DimensionResult[], name: string): number | null {
  const d = dimensions.find(dim => dim.name === name);
  return d != null ? d.passRate : null;
}

function deriveRecommendations(data: ReportData): Recommendation[] {
  const safetyRate = dimRate(data.dimensions, 'Safety');
  const accuracyRate = dimRate(data.dimensions, 'Accuracy');
  const effectivenessRate = dimRate(data.dimensions, 'Effectiveness');
  const easeRate = dimRate(data.dimensions, 'Ease of Use');
  const emotionRate = dimRate(data.dimensions, 'Emotion');

  function metricTag(metric: EvalMetric): { label: string; rate: number } {
    const rate = dimRate(data.dimensions, METRIC_LABELS[metric]);
    return { label: METRIC_LABELS[metric], rate: rate != null ? rate : -1 };
  }

  const recs: Recommendation[] = [
    {
      id: 'safety-guardrails',
      headline: 'Review your safety guardrails',
      explanation: 'Safety failures mean the AI gave responses that could mislead or harm the people using it. Even one safety failure is worth investigating.',
      steps: [
        'Review each safety failure in the Details tab',
        'Identify the types of unsafe content the AI produced',
        'Work with your technical team to add protections for those specific issues',
        'Re-run the evaluation to confirm the fixes work',
      ],
      metrics: ['safety'],
      metricRates: [metricTag('safety')].filter(m => m.rate >= 0),
      priority: 1,
      technicalHeadline: 'For your technical team',
      technicalSteps: [
        'Harden the system prompt with explicit safety boundaries for the identified failure modes',
        'Add output filtering or classifier-based guardrails (e.g. moderation API, custom classifiers)',
        'Consider a content-safety layer that screens responses before they reach the user',
        'Log and alert on safety failures in production for ongoing monitoring',
      ],
    },
    {
      id: 'improve-knowledge',
      headline: 'Improve the information your AI draws from',
      explanation: 'When the AI gets facts wrong, it usually means the information it has access to is incomplete, outdated, or poorly organized.',
      steps: [
        'Check whether the source documents your AI uses are current and complete',
        'Identify which facts the AI got wrong (see Details tab) and verify them against your records',
        'Work with your technical team to improve how information is stored and retrieved',
        'Add missing facts to the knowledge base or correct outdated ones',
      ],
      metrics: ['accuracy'],
      metricRates: [metricTag('accuracy')].filter(m => m.rate >= 0),
      priority: 2,
      technicalHeadline: 'For your technical team',
      technicalSteps: [
        'Review document chunking strategy \u2014 smaller, overlapping chunks often improve retrieval accuracy',
        'Evaluate your embedding model and consider re-indexing with a higher-quality model',
        'Tune retrieval parameters (top-k results, similarity threshold) to improve relevance',
        'Add structured metadata (dates, categories, source authority) to improve retrieval filtering',
        'Consider a hybrid search approach combining semantic and keyword-based retrieval',
      ],
    },
    {
      id: 'strengthen-instructions',
      headline: 'Strengthen the instructions your AI follows',
      explanation: 'When the AI understands the question but doesn\u2019t respond in the most helpful way, the instructions it follows (system prompt) likely need improvement.',
      steps: [
        'Review the responses that weren\u2019t effective or easy to understand (see Details tab)',
        'Look for patterns \u2014 are responses too long, too vague, or missing key steps?',
        'Update the instructions to address the gaps you\u2019ve identified',
        'Add examples of good responses so the AI knows what to aim for',
      ],
      metrics: ['effectiveness', 'ease-of-use'],
      metricRates: [metricTag('effectiveness'), metricTag('ease-of-use')].filter(m => m.rate >= 0),
      priority: 3,
      technicalHeadline: 'For your technical team',
      technicalSteps: [
        'Revise the system prompt with explicit formatting guidance and response structure',
        'Add few-shot examples that demonstrate ideal responses for common question types',
        'Include plain-language directives: "avoid jargon", "explain acronyms", "give the next step"',
        'Consider breaking complex prompts into a chain of smaller, focused prompts',
        'Test system prompt changes in isolation before deploying to see measurable improvement',
      ],
    },
    {
      id: 'adjust-tone',
      headline: 'Adjust the tone and style',
      explanation: 'People using government services are often in stressful situations. If the AI\u2019s tone feels cold, robotic, or dismissive, it can make things worse even when the information is correct.',
      steps: [
        'Read through the emotion-related failures in the Details tab',
        'Note where the AI could have acknowledged the person\u2019s situation before answering',
        'Update the instructions to include guidance about tone and empathy',
        'Consider adding specific phrases the AI should use in sensitive situations',
      ],
      metrics: ['emotion'],
      metricRates: [metricTag('emotion')].filter(m => m.rate >= 0),
      priority: 4,
      technicalHeadline: 'For your technical team',
      technicalSteps: [
        'Add tone guidance to the system prompt: "acknowledge the user\u2019s situation before providing information"',
        'Include examples of empathetic phrasing for common sensitive topics',
        'Consider using a separate tone-check step that evaluates response empathy before delivery',
        'Avoid overly formal or bureaucratic language patterns in prompt templates',
      ],
    },
    {
      id: 'consider-model',
      headline: 'Consider a different AI model',
      explanation: 'Different AI models have different strengths. If you tested more than one, comparing their results can reveal whether switching models would make a meaningful difference.',
      steps: [
        'Compare pass rates across models in the Analysis tab',
        'Check if one model is consistently better across all categories, or only in specific areas',
        'Factor in cost and speed \u2014 a more expensive model is only worth it if the improvement matters',
        'Discuss trade-offs with your technical team before switching',
      ],
      metrics: [],
      metricRates: data.providers.map(p => ({ label: p.name, rate: p.passRate })),
      priority: 5,
      technicalHeadline: 'For your technical team',
      technicalSteps: [
        'Compare model performance on each metric dimension, not just overall pass rate',
        'Evaluate cost per evaluation \u2014 larger models may not justify their cost for your use case',
        'Consider latency requirements, especially for real-time user-facing applications',
        'Fine-tuning is rarely necessary for public-sector chatbots \u2014 prompt engineering and retrieval improvements usually deliver better ROI',
        'Test candidate models with the same evaluation suite to get an apples-to-apples comparison',
      ],
    },
    {
      id: 'talk-to-users',
      headline: 'Talk to the people who use this service',
      explanation: 'The best way to improve your AI is to understand what real people actually need from it. Test cases based on real user questions catch problems that hypothetical scenarios miss.',
      steps: [
        'Interview 5\u201310 people who use (or would use) this service',
        'Ask what questions they\u2019d ask, what words they\u2019d use, and what would actually help them',
        'Add their real questions to your test suite as new test cases',
        'Pay special attention to edge cases and situations that are hard to handle',
      ],
      metrics: ['effectiveness'],
      metricRates: [metricTag('effectiveness')].filter(m => m.rate >= 0),
      priority: 6,
      technicalHeadline: 'For your technical team',
      technicalSteps: [
        'Analyze production logs to identify the most common user questions and failure modes',
        'Build test cases from real user interactions, not just policy documents',
        'Expand test coverage to include multilingual queries and accessibility scenarios',
        'Set up a feedback loop so user-reported issues automatically become new test cases',
        'Consider A/B testing different response strategies with real users',
      ],
    },
    {
      id: 'run-again',
      headline: 'Run this evaluation again after making changes',
      explanation: 'Evaluation isn\u2019t a one-time activity. Every time you update the AI\u2019s instructions, data, or model, run the same tests again to make sure things got better, not worse.',
      steps: [
        'Make one or two focused changes based on the recommendations above',
        'Re-run this same evaluation to measure the impact',
        'Compare your new pass rates against this baseline',
        'Repeat until you\u2019re confident the AI is ready for real users',
      ],
      metrics: [],
      metricRates: [],
      priority: 7,
      technicalHeadline: 'For your technical team',
      technicalSteps: [
        'Integrate evaluation into your CI/CD pipeline so it runs automatically on every deployment',
        'Track pass rates across runs to establish improvement trends',
        'Set up automated alerts when pass rates drop below acceptable thresholds',
        'Version your test suites alongside your code to maintain reproducibility',
      ],
    },
  ];

  return recs;
}

// ---------- HTML Rendering ----------

function renderHtml(data: ReportData, jobId?: string): string {
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
          <div class="cf-remediation" style="margin-top:8px;padding:8px 12px;background:#f0f4f8;border-radius:4px;font-size:0.8125rem;color:#334155;">
            <strong>Suggested fix:</strong> ${esc(cf.remediation)}
          </div>
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

    const conversationHtml = tc.turns && tc.turns.length === 4 ? `
      <div class="ev-conversation">
        <div class="ev-conv-label">Conversation history</div>
        <div class="ev-turn ev-turn--user">
          <span class="ev-turn-label">Turn 1 — User</span>
          <div class="ev-turn-content">${esc(tc.turns[0].content)}</div>
        </div>
        <div class="ev-turn ev-turn--assistant">
          <span class="ev-turn-label">Turn 1 — AI (seeded)</span>
          <div class="ev-turn-content">${esc(tc.turns[1].content)}</div>
        </div>
        <div class="ev-turn ev-turn--user">
          <span class="ev-turn-label">Turn 2 — User</span>
          <div class="ev-turn-content">${esc(tc.turns[2].content)}</div>
        </div>
        <div class="ev-turn ev-turn--assistant">
          <span class="ev-turn-label">Turn 2 — AI (seeded)</span>
          <div class="ev-turn-content">${esc(tc.turns[3].content)}</div>
        </div>
        <div class="ev-turn ev-turn--user ev-turn--final">
          <span class="ev-turn-label">Turn 3 — User (live, graded)</span>
          <div class="ev-turn-content">${esc(tc.question)}</div>
        </div>
      </div>` : '';

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
      <tbody class="test-case-group" data-severity="${tc.severity}" data-passed="${!tc.anyFailed}" data-metric="${tc.metric}" tabindex="0" role="button" aria-expanded="false" aria-controls="detail-${tc.number}" onclick="toggleRow(${tc.number})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleRow(${tc.number})}">
        <tr class="main-row ${tc.anyFailed ? 'fail-row' : 'pass-row'}">
          <td class="tc-num">${tc.number}</td>
          <td class="tc-question">${esc(tc.question)}</td>
          <td><span class="usa-tag severity-badge ${tc.severity}">${tc.severity}</span></td>
          <td class="tc-check">
            <span class="check-badge metric-${tc.metric}" title="${esc(tc.metricTooltip)}">${esc(tc.metricLabel)}</span>
            ${tc.personaLabel ? `<span class="persona-badge">${esc(tc.personaLabel)}</span>` : ''}
          </td>
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
              ${conversationHtml}
              ${expandedContent}
              ${jobId ? `
              <div class="ev-feedback" id="fb-${tc.number}">
                <span class="ev-feedback-label">Was this graded correctly?</span>
                <button class="ev-thumb" onclick="submitFeedback(${tc.number}, 1)" aria-label="Yes, correct" title="Correct">&#128077;</button>
                <button class="ev-thumb" onclick="submitFeedback(${tc.number}, 0)" aria-label="No, incorrect" title="Incorrect">&#128078;</button>
                <span class="ev-feedback-thanks" id="fb-thanks-${tc.number}"></span>
              </div>` : ''}
            </div>
          </td>
        </tr>
      </tbody>`;
  }).join('');

  const failedCount = data.testCases.filter(tc => tc.anyFailed).length;

  const metricFilterButtons = METRIC_ORDER
    .filter(m => data.testCases.some(tc => tc.metric === m))
    .map(m => {
      const count = data.testCases.filter(tc => tc.metric === m).length;
      return `<button class="usa-button usa-button--outline filter-btn filter-btn-metric" data-filter="metric-${m}" onclick="applyFilter('metric-${m}')">
      ${esc(METRIC_LABELS[m])} <span class="filter-count">${count}</span>
    </button>`;
    }).join('\n    ');

  // ── Recommendations tab ─────────────────────────────────────────────

  const recommendationCardsHtml = data.recommendations.map((rec, i) => {
    const stepsHtml = rec.steps.map(s => `<li>${esc(s)}</li>`).join('');
    const techStepsHtml = rec.technicalSteps.map(s => `<li>${esc(s)}</li>`).join('');
    const tagsHtml = rec.metricRates.map(m =>
      `<span class="rec-evidence-tag">${esc(m.label)}: ${m.rate}%</span>`
    ).join('');
    return `
    <details class="rec-card">
      <summary class="rec-summary">
        <div class="rec-number">${i + 1}</div>
        <h3 class="rec-headline">${esc(rec.headline)}</h3>
        <span class="rec-chevron">&#9662;</span>
      </summary>
      <div class="rec-body">
        <p class="rec-explanation">${esc(rec.explanation)}</p>
        <div class="rec-steps">
          <div class="rec-steps-label">Steps to take</div>
          <ol class="rec-step-list">${stepsHtml}</ol>
        </div>
        ${tagsHtml ? `<div class="rec-evidence">
          <span class="rec-evidence-label">Your results:</span>
          ${tagsHtml}
        </div>` : ''}
        <details class="rec-technical">
          <summary class="rec-tech-toggle">${esc(rec.technicalHeadline)}</summary>
          <div class="rec-tech-content">
            <ol class="rec-tech-list">${techStepsHtml}</ol>
          </div>
        </details>
      </div>
    </details>`;
  }).join('');

  // ── Full HTML ──────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(data.title)} — Evergreen Eval Report</title>
<link rel="stylesheet" href="/assets/css/uswds.min.css">
<link rel="stylesheet" href="/assets/css/evergreen.css">
<style>
/* ── Tokens ── */
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
  --mono:         ui-monospace, 'SFMono-Regular', 'Courier New', monospace;
  --radius:       4px;
  --shadow:       0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05);
  --shadow-md:    0 4px 12px rgba(0,0,0,.10);
}

/* ── Base ── */
body {
  background: var(--bg);
  color: var(--text);
}

/* ── Header ── */
.evergreen-hero {
  background: linear-gradient(135deg, #112e51 0%, #205493 100%);
  color: #fff;
  padding: 2.5rem 0 2rem;
}
.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.hero-titles { flex: 1; min-width: 0; }
.hero-action { flex-shrink: 0; margin-top: 4px; }
.hero-action .usa-button--outline {
  color: #112e51;
  border-color: #fff;
  background: #fff;
}
.hero-action .usa-button--outline:hover {
  background: #dce4ef;
  border-color: #dce4ef;
  color: #112e51;
}
.evergreen-hero h1 {
  color: #fff;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}
.evergreen-hero .meta {
  font-size: 13px;
  color: #dce4ef;
  display: flex;
  gap: 0;
  flex-wrap: wrap;
}
.evergreen-hero .meta span + span::before { content: "·"; margin: 0 10px; color: #94a3b8; }
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
  padding: 0;
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: var(--shadow);
}
.tab-btn {
  padding: 14px 22px;
  border: none;
  background: none;

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
.tab-content { display: none; padding: 2rem 0 3.75rem; }
.tab-content.active { display: block; }

/* ── Cards ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem;
  margin-bottom: 1.5rem;
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
.bar-fill.green  { background: linear-gradient(90deg, #008817, var(--pass)); }
.bar-fill.yellow { background: linear-gradient(90deg, #936f38, var(--warn)); }
.bar-fill.red    { background: linear-gradient(90deg, #b50909, var(--fail)); }
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
.check-badge.metric-safety       { background: #fee2e2; color: #991b1b; }
.check-badge.metric-accuracy     { background: #dbeafe; color: #1e40af; }
.check-badge.metric-ease-of-use  { background: #d1fae5; color: #065f46; }
.check-badge.metric-effectiveness{ background: #fef9c3; color: #854d0e; }
.check-badge.metric-emotion      { background: #ede9fe; color: #5b21b6; }

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

  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  transition: all .15s;
}
.filter-btn .filter-count {
  background: rgba(255,255,255,.25);
  border-radius: 10px;
  padding: 0 5px;
  font-size: 11px;
  margin-left: 4px;
}
.filter-btn:not(.active) .filter-count { background: var(--border-sub); color: var(--text-3); }
.filter-group-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-right: 2px; }
/* Status/severity group — warm amber accent */
.filter-btn-status:hover { border-color: #c05600; color: #c05600; }
.filter-btn-status.active { background: #c05600; border-color: #c05600; color: #fff; font-weight: 600; }
/* Metric group — blue accent */
.filter-btn-metric:hover { border-color: var(--brand); color: var(--brand); }
.filter-btn-metric.active { background: var(--brand); border-color: var(--brand); color: #fff; font-weight: 600; }
.filter-divider { width: 1px; height: 24px; background: var(--border); margin: 0 4px; flex-shrink: 0; }
.filter-result { font-size: 13px; color: var(--text-3); margin-left: auto; }
.toggle-expand { font-size: 12px; color: var(--brand); cursor: pointer; white-space: nowrap; flex-shrink: 0; }

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
.ev-feedback {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.ev-feedback-label { font-size: 12px; color: var(--muted); }
.ev-thumb {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s;
}
.ev-thumb:hover { background: #f0f4ff; border-color: #4a90e2; }
.ev-thumb:disabled { opacity: 0.4; cursor: default; }
.ev-feedback-thanks { font-size: 12px; color: #2e8540; font-weight: 600; }
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

/* .methodology replaced by usa-footer--slim */
.pass   { color: var(--pass); }
.fail   { color: var(--fail); }
.neutral{ color: var(--neutral); }

/* ── Mobile responsive tables ── */
@media (max-width: 768px) {
  .detail-card { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .detail-table { min-width: 600px; }
  .detail-table th, .detail-table td { padding: 8px 10px; font-size: 12px; }
  .tc-question { max-width: 200px; }
  .data-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .cf-comparison { grid-template-columns: 1fr; }
  .bar-track { width: 120px; }
  .exp-grading { min-width: 200px; max-width: 260px; }
}
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr; }
  .bar-row { grid-template-columns: 1fr; gap: 4px; }
  .bar-track { width: 100%; }
  .bar-pct { text-align: left; width: auto; }
  .tab-btn { padding: 10px 14px; font-size: 13px; }
  .readiness-hero { padding: 20px 16px; }
  .rh-status { font-size: 18px; }
  .rh-explanation { font-size: 14px; }
  .card { padding: 1.25rem; }
}

/* ── Recommendations tab ── */
.rec-intro { font-size: 14px; color: var(--text-2); line-height: 1.6; margin: 0; }
.rec-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  margin-bottom: 8px; list-style: none;
}
.rec-card[open] { border-color: var(--brand); }
.rec-card::-webkit-details-marker { display: none; }
.rec-summary {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 20px; cursor: pointer; list-style: none; user-select: none;
}
.rec-summary::-webkit-details-marker { display: none; }
.rec-summary::marker { content: ''; }
.rec-summary:hover { background: #f8fafc; border-radius: var(--radius); }
.rec-card[open] .rec-summary { border-bottom: 1px solid var(--border); }
.rec-number {
  flex-shrink: 0; width: 28px; height: 28px; background: var(--brand); color: #fff;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 13px;
}
.rec-headline { font-size: 15px; font-weight: 600; color: var(--text); margin: 0; flex: 1; }
.rec-chevron { color: var(--text-3); font-size: 12px; flex-shrink: 0; transition: transform 0.15s; }
.rec-card[open] .rec-chevron { transform: rotate(180deg); }
.rec-body { padding: 20px 20px 20px 62px; }
.rec-explanation { font-size: 14px; color: var(--text-2); line-height: 1.6; margin: 0 0 16px; }
.rec-steps-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--text-3); margin-bottom: 8px;
}
.rec-step-list { margin: 0 0 16px; padding-left: 20px; }
.rec-step-list li { font-size: 14px; color: var(--text); line-height: 1.6; margin-bottom: 4px; }
.rec-evidence { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 16px; }
.rec-evidence-label { font-size: 12px; font-weight: 600; color: var(--text-2); }
.rec-evidence-tag {
  font-size: 11px; font-weight: 600; padding: 2px 8px; background: var(--border-sub);
  border-radius: 4px; color: var(--text-2);
}
.rec-technical { border-top: 1px solid var(--border-sub); padding-top: 12px; }
.rec-tech-toggle {
  font-size: 13px; font-weight: 600; color: var(--brand); cursor: pointer; list-style: none;
}
.rec-tech-toggle::-webkit-details-marker { display: none; }
.rec-tech-toggle::marker { content: ''; }
.rec-tech-content { margin-top: 10px; padding: 14px 16px; background: #f0f4f8; border-radius: 6px; }
.rec-tech-list { margin: 0; padding-left: 20px; }
.rec-tech-list li { font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 4px; }
@media (max-width: 680px) {
  .rec-body { padding: 16px; }
  .rec-summary { padding: 14px 16px; }
}

/* ── Persona badge ── */
.persona-badge {
  display: inline-block;
  margin-left: 5px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: #ede9fe;
  color: #5b21b6;
  white-space: nowrap;
  vertical-align: middle;
}

/* ── Conversation history (multi-turn) ── */
.ev-conversation {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: #f8fafc;
}
.ev-conv-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-3);
  margin-bottom: 10px;
}
.ev-turn {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
  align-items: flex-start;
}
.ev-turn-label {
  flex-shrink: 0;
  min-width: 140px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  padding-top: 2px;
}
.ev-turn-content {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 6px 10px;
  flex: 1;
}
.ev-turn--assistant .ev-turn-label { color: #1e40af; }
.ev-turn--assistant .ev-turn-content { background: #eff6ff; border-color: #bfdbfe; }
.ev-turn--final .ev-turn-content { border-color: var(--brand); background: #f0f4ff; }
.ev-turn--final .ev-turn-label { color: var(--brand); }

/* ── Feedback (thumbs up/down) ── */
.ev-feedback {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.ev-feedback-label {
  font-size: 13px;
  color: var(--text-2);
}
.ev-thumb {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 16px;
  cursor: pointer;
  transition: background .15s;
}
.ev-thumb:hover { background: var(--border-sub); }
.ev-thumb:disabled { opacity: .5; cursor: default; }
.ev-feedback-thanks {
  font-size: 12px;
  color: var(--text-3);
  font-style: italic;
}

/* ── Print ── */
@media print {
  .tab-nav { position: static; box-shadow: none; }
  .tab-content { display: block !important; page-break-before: always; padding: 20px; }
  .tab-content:first-of-type { page-break-before: auto; }
  .filter-bar { display: none; }
  .expanded-detail { display: block !important; }
  .chevron { display: none; }
  .sev-link { display: none; }
  .padding-x-4.padding-top-3 { display: none; }
  .rec-technical[open] .rec-tech-content { display: block; }
  .rec-tech-toggle { color: var(--text); }
}
</style>
</head>
<body>

<!-- Public Infrastructure Banner -->
<section class="usa-banner" aria-label="Evergreen — digital public infrastructure">
  <div class="usa-banner__header">
    <div class="usa-banner__inner">
      <div class="grid-col-auto">
        <img class="usa-banner__header-flag" src="/assets/img/us_flag_small.png" alt="U.S. flag">
      </div>
      <div class="grid-col-fill">
        <p class="usa-banner__header-text">This is digital public infrastructure &mdash; by the people, for the people.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── Report Nav ── -->
<div class="padding-x-4 padding-top-3">
  <a href="/builder" class="usa-button usa-button--unstyled">\u2190 Back to Builder</a>
</div>

<!-- ── Header ── -->
<header class="evergreen-hero">
  <div class="grid-container">
    <div class="hero-top">
      <div class="hero-titles">
        <h1>${esc(data.title)}</h1>
        <div class="meta">
          <span>${esc(data.date)}</span>
          <span>${data.testCaseCount} test cases</span>
          <span>${esc(data.providerList)}</span>
          <span>${esc(data.testSource)}</span>
          ${data.agencyName ? `<span>${esc(data.agencyName)}</span>` : ''}
          ${data.evaluatorName ? `<span>Evaluator: ${esc(data.evaluatorName)}</span>` : ''}
          ${data.evaluationReason ? `<span>${esc(data.evaluationReason)}</span>` : ''}
        </div>
      </div>
      <div class="hero-action">
        <button class="usa-button usa-button--outline" onclick="downloadReport()" style="margin-right:8px">Download Report</button>
        ${data.presetId ? `<a href="/builder?template=${encodeURIComponent(data.presetId)}" class="usa-button usa-button--outline" style="margin-right:8px">Edit Test Cases</a>` : ''}
        <a href="/" class="usa-button usa-button--outline">New Evaluation</a>
      </div>
    </div>
    <div class="readiness-pill ${data.readinessClass}">${esc(data.readinessLabel)}</div>
  </div>
</header>

<!-- ── Tab nav ── -->
<nav class="tab-nav">
  <div class="grid-container" style="display:flex">
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
    <button class="tab-btn" data-tab="recommendations">
      <span class="tab-label">Recommendations</span>
      <span class="tab-sub">What to do next</span>
    </button>
  </div>
</nav>

<!-- ── Summary tab ── -->
<section class="tab-content active" id="tab-summary">
<div class="grid-container">

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

</div>
</section>

<!-- ── Analysis tab ── -->
<section class="tab-content" id="tab-analysis">
<div class="grid-container">

  <div class="card">
    <h2 class="card-title">Results by Lead Metric</h2>
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

</div>
</section>

<!-- ── Details tab ── -->
<section class="tab-content" id="tab-details">
<div class="grid-container">

  <div class="filter-bar">
    <span class="filter-group-label">Status</span>
    <button class="usa-button filter-btn filter-btn-status active" data-filter="all" onclick="applyFilter('all')">
      All <span class="filter-count">${data.testCaseCount}</span>
    </button>
    <button class="usa-button usa-button--outline filter-btn filter-btn-status" data-filter="failures" onclick="applyFilter('failures')">
      Failures <span class="filter-count">${failedCount}</span>
    </button>
    <button class="usa-button usa-button--outline filter-btn filter-btn-status" data-filter="critical" onclick="applyFilter('critical')">
      Critical <span class="filter-count">${data.criticalCaseCount}</span>
    </button>
    <span class="filter-divider"></span>
    <span class="filter-group-label">Metric</span>
    ${metricFilterButtons}
    <span class="filter-result" id="filter-result"></span>
    <button class="usa-button usa-button--unstyled toggle-expand" id="toggle-expand" onclick="toggleExpandAll()">Expand all</button>
  </div>

  <div class="detail-card">
    <table class="detail-table usa-table usa-table--borderless usa-table--compact">
      <thead>
        <tr>
          <th>#</th>
          <th>Question</th>
          <th>Severity</th>
          <th>Metric</th>
          ${providerHeaders}
          <th></th>
        </tr>
      </thead>
      ${detailRowsHtml}
    </table>
  </div>

</div>
</section>

<!-- ── Recommendations tab ── -->
<section class="tab-content" id="tab-recommendations">
<div class="grid-container">

  <div class="card">
    <h2 class="card-title">Recommendations</h2>
    <p class="rec-intro">Based on the patterns in your evaluation results, here are specific steps to improve your AI system. Each recommendation includes guidance for your technical team.</p>
  </div>

  ${recommendationCardsHtml}

</div>
</section>

<!-- ── Footer ── -->
<footer class="usa-footer usa-footer--slim">
  <div class="usa-footer__primary-section"></div>
  <div class="usa-footer__secondary-section">
    <div class="grid-container">
      <p class="font-body-xs text-base-dark">
        <strong>Framework:</strong> Evergreen 4-Dimension Eval &middot;
        <strong>Test Source:</strong> ${esc(data.testSource)} &middot;
        <strong>Metrics:</strong> ${esc(data.gradingMethods)} &middot;
        <strong>Generated:</strong> ${esc(data.generatedAt)}
        ${data.systemPrompt ? ` &middot; <strong>System Prompt:</strong> ${esc(data.systemPrompt.length > 120 ? data.systemPrompt.slice(0, 120) + '\u2026' : data.systemPrompt)}` : ''}
      </p>
    </div>
  </div>
</footer>

<script src="/assets/js/uswds.min.js"></script>
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
    // Update ARIA state on parent tbody
    var tbody = detail.closest('.test-case-group');
    if (tbody) tbody.setAttribute('aria-expanded', String(isOpen));
  }
  window.toggleRow = toggleRow;

  // Stop click inside expanded detail from collapsing the row
  document.querySelectorAll('.expanded-detail').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); });
  });

  // ── Details filter ──
  var currentFilter = 'all';
  var severityLevels = ['critical', 'high', 'medium', 'low'];
  function applyFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      var isActive = btn.dataset.filter === filter;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('usa-button--outline', !isActive);
    });
    var isSeverityFilter = severityLevels.indexOf(filter) !== -1;
    var isMetricFilter = filter.indexOf('metric-') === 0;
    var metricValue = isMetricFilter ? filter.slice(7) : '';
    var total = 0, visible = 0;
    document.querySelectorAll('.test-case-group').forEach(function(group) {
      total++;
      var sev = group.dataset.severity;
      var passed = group.dataset.passed === 'true';
      var metric = group.dataset.metric;
      var show = true;
      if (filter === 'failures' && passed) show = false;
      else if (isSeverityFilter && sev !== filter) show = false;
      else if (isMetricFilter && metric !== metricValue) show = false;
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
    applyFilter(sev);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  window.gotoSeverity = gotoSeverity;

  // ── Expand / collapse all ──
  var allExpanded = false;
  function toggleExpandAll() {
    allExpanded = !allExpanded;
    document.querySelectorAll('.expanded-detail').forEach(function(el) {
      el.classList.toggle('open', allExpanded);
    });
    document.querySelectorAll('.chevron').forEach(function(el) {
      el.classList.toggle('open', allExpanded);
    });
    document.querySelectorAll('.test-case-group').forEach(function(el) {
      el.setAttribute('aria-expanded', String(allExpanded));
    });
    var btn = document.getElementById('toggle-expand');
    if (btn) btn.textContent = allExpanded ? 'Collapse all' : 'Expand all';
  }
  window.toggleExpandAll = toggleExpandAll;

  // ── Download report ──
  function downloadReport() {
    var html = document.documentElement.outerHTML;
    var blob = new Blob(['<!DOCTYPE html>' + html], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'evergreen-report.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
  window.downloadReport = downloadReport;

  ${jobId ? `
  // ── User feedback (thumbs up / down) ──
  var REPORT_JOB_ID = '${jobId}';
  function submitFeedback(testNumber, value) {
    var area = document.getElementById('fb-' + testNumber);
    if (!area) return;
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: REPORT_JOB_ID, testNumber: testNumber, value: value }),
    })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function() {
      area.querySelectorAll('.ev-thumb').forEach(function(b) {
        b.disabled = true;
      });
      var thanks = document.getElementById('fb-thanks-' + testNumber);
      if (thanks) thanks.textContent = value === 1 ? 'Marked correct \u2713' : 'Marked incorrect \u2713';
    })
    .catch(function() {
      var thanks = document.getElementById('fb-thanks-' + testNumber);
      if (thanks) thanks.textContent = 'Could not save \u2014 feedback window may have expired.';
    });
  }
  window.submitFeedback = submitFeedback;
  ` : ''}

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

export function generateReport(input: EvalResults, jobId?: string): string {
  const data = deriveReportData(input);
  return renderHtml(data, jobId);
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
