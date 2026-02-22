/**
 * End-to-end pipeline test.
 *
 * Tests: CSV parsing → config generation → report mapping → HTML output
 * Does NOT require network or API keys (mocks the sheet fetch and Promptfoo run).
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseCsv } from '../src/sheets';
import { buildPromptfooConfig, writePromptfooConfig } from '../src/config';
import { mapToEvalResults } from '../src/mapper';
import { generateReport } from '../src/report/generator';
import { EvergreenConfig, PromptfooOutput } from '../src/types';

// ── Test Data ──

const TEST_CSV = `Question,Expected Answer,Context,Check Type,Severity
What is the Colorado state income tax rate?,4.4%,,contains,critical
"Do I owe CO tax if I work remotely for a CO company, but live in another state?","Depends on whether you are domiciled in CO or have CO-source income","Remote worker, out-of-state employer",llm-rubric,high
How do I file my CO state tax return?,"Revenue Online, paper form, tax software",,contains-all,medium
"Can I deduct federal taxes on my CO return?",you cannot deduct,CO-specific SALT rules,not-contains,critical
When is the CO tax filing deadline?,April 15,,contains,high`;

const TEST_CONFIG: EvergreenConfig = {
  description: 'CO Tax Policy Chatbot — Test',
  sheetId: 'test-sheet-id',
  sheetRange: 'A2:E',
  providers: [
    {
      id: 'openai:gpt-4o',
      systemPrompt: 'You are a helpful assistant for Colorado state tax questions.',
    },
  ],
  outputPath: './test-results.json',
};

// Mock Promptfoo output (simulates what Promptfoo would return)
function mockPromptfooOutput(testCount: number): PromptfooOutput {
  const results = [];
  for (let i = 0; i < testCount; i++) {
    const passed = i !== 3; // Test case 4 (deduction) fails
    results.push({
      prompt: { raw: `Test question ${i + 1}` },
      provider: { id: 'openai:gpt-4o', label: 'GPT-4o' },
      vars: { question: `Test question ${i + 1}` },
      response: { output: passed
        ? `Correct answer for test ${i + 1}. The Colorado income tax rate is 4.4%.`
        : `You cannot deduct federal taxes on your Colorado return. This is not allowed.`
      },
      success: passed,
      score: passed ? 1 : 0,
      gradingResult: {
        pass: passed,
        reason: passed ? 'Assertion passed: contains expected text' : 'Assertion failed: response contains prohibited text "you cannot deduct"',
      },
    });
  }
  return {
    results,
    stats: {
      successes: results.filter(r => r.success).length,
      failures: results.filter(r => !r.success).length,
      errors: 0,
    },
  };
}

// ── Tests ──

function testCsvParsing(): void {
  console.log('Test 1: CSV Parsing');
  const rows = parseCsv(TEST_CSV);

  assert(rows.length === 5, `Expected 5 rows, got ${rows.length}`);
  assert(rows[0].question === 'What is the Colorado state income tax rate?', 'Q1 text mismatch');
  assert(rows[0].expectedAnswer === '4.4%', 'Q1 expected answer mismatch');
  assert(rows[0].checkType === 'contains', 'Q1 check type mismatch');
  assert(rows[0].severity === 'critical', 'Q1 severity mismatch');

  // Test quoted field with comma
  assert(rows[1].question.includes('but live in another state'), 'Q2 should handle quoted comma');
  assert(rows[1].context === 'Remote worker, out-of-state employer', 'Q2 context mismatch');
  assert(rows[1].checkType === 'llm-rubric', 'Q2 check type mismatch');

  // contains-all
  assert(rows[2].checkType === 'contains-all', 'Q3 check type mismatch');
  assert(rows[2].expectedAnswer.includes('Revenue Online'), 'Q3 expected answer mismatch');

  // not-contains
  assert(rows[3].checkType === 'not-contains', 'Q4 check type mismatch');

  console.log('  PASSED (5 rows parsed, quoted fields handled, all check types recognized)\n');
}

function testConfigGeneration(): void {
  console.log('Test 2: Promptfoo Config Generation');
  const rows = parseCsv(TEST_CSV);
  const pfConfig = buildPromptfooConfig(rows, TEST_CONFIG);

  assert(pfConfig.description === TEST_CONFIG.description, 'Description mismatch');
  assert(pfConfig.providers.length === 1, 'Should have 1 provider');
  assert(pfConfig.tests.length === 5, `Should have 5 tests, got ${pfConfig.tests.length}`);

  // Check contains assertion
  assert(pfConfig.tests[0].assert[0].type === 'contains', 'Test 1 assertion type');
  assert(pfConfig.tests[0].assert[0].value === '4.4%', 'Test 1 assertion value');

  // Check llm-rubric assertion
  assert(pfConfig.tests[1].assert[0].type === 'llm-rubric', 'Test 2 assertion type');

  // Check contains-all generates multiple contains
  assert(pfConfig.tests[2].assert.length === 3, `contains-all should split to 3 assertions, got ${pfConfig.tests[2].assert.length}`);
  assert(pfConfig.tests[2].assert[0].type === 'contains', 'contains-all sub-assertion type');
  assert(pfConfig.tests[2].assert[0].value === 'Revenue Online', 'contains-all first value');

  // Check not-contains assertion
  assert(pfConfig.tests[3].assert[0].type === 'not-contains', 'Test 4 assertion type');

  // Check context is prepended to question
  assert(pfConfig.tests[1].vars.question.includes('Context:'), 'Context should be prepended');

  // Write YAML and verify it's valid
  const outPath = '/tmp/test-promptfoo-config.yaml';
  writePromptfooConfig(pfConfig, outPath);
  const yaml = fs.readFileSync(outPath, 'utf-8');
  assert(yaml.includes('openai:gpt-4o'), 'YAML should contain provider');
  assert(yaml.includes('4.4%'), 'YAML should contain assertion value');
  fs.unlinkSync(outPath);

  console.log('  PASSED (config generated, assertions mapped, YAML valid)\n');
}

function testReportMapping(): void {
  console.log('Test 3: Promptfoo Output → Report Mapping');
  const rows = parseCsv(TEST_CSV);
  const pfOutput = mockPromptfooOutput(rows.length);
  const evalResults = mapToEvalResults(pfOutput, rows, TEST_CONFIG.description);

  assert(evalResults.title === TEST_CONFIG.description, 'Title mismatch');
  assert(evalResults.providers.length === 1, 'Should have 1 provider');
  assert(evalResults.providers[0] === 'GPT-4o', `Provider name: ${evalResults.providers[0]}`);
  assert(evalResults.testCases.length === 5, 'Should have 5 test cases');

  // Check test case 4 failed (not-contains — response includes prohibited text)
  assert(!evalResults.testCases[3].results[0].passed, 'Test case 4 should fail');
  assert(evalResults.testCases[3].severity === 'critical', 'Test case 4 should be critical');

  // Check test case 1 passed
  assert(evalResults.testCases[0].results[0].passed, 'Test case 1 should pass');

  console.log('  PASSED (5 test cases mapped, failures preserved, severity correct)\n');
}

function testReportGeneration(): void {
  console.log('Test 4: HTML Report Generation');
  const rows = parseCsv(TEST_CSV);
  const pfOutput = mockPromptfooOutput(rows.length);
  const evalResults = mapToEvalResults(pfOutput, rows, TEST_CONFIG.description);
  const html = generateReport(evalResults);

  assert(html.includes('<!DOCTYPE html>'), 'Should be valid HTML');
  assert(html.includes('CO Tax Policy Chatbot'), 'Should contain title');
  assert(html.includes('Not Ready for Deployment'), 'Should show not-ready (critical failure)');
  assert(html.includes('Critical Failures'), 'Should have critical failures section');
  assert(html.includes('you cannot deduct'), 'Should include the failed response');
  assert(html.includes('tab-summary'), 'Should have summary tab');
  assert(html.includes('tab-analysis'), 'Should have analysis tab');
  assert(html.includes('tab-details'), 'Should have details tab');

  // Write report to disk for manual inspection
  const outPath = path.join(__dirname, '..', 'examples', 'sample-report', 'report.html');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`  Report written to: ${outPath}`);

  console.log('  PASSED (HTML valid, 3 tabs, readiness badge, critical failures shown)\n');
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
}

// ── Run ──

console.log('');
console.log('=== Evergreen End-to-End Pipeline Test ===');
console.log('');

try {
  testCsvParsing();
  testConfigGeneration();
  testReportMapping();
  testReportGeneration();
  console.log('All tests passed.');
  console.log('');
} catch (err) {
  console.error('TEST FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
}
