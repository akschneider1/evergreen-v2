/**
 * Setup page UI generator.
 *
 * Produces a self-contained HTML page using USWDS v3.13.0 (via CDN).
 * The page lets a non-technical user paste a Google Sheet URL,
 * configure the eval, click "Run", and watch progress.
 */

const USWDS_VERSION = '3.13.0';
const USWDS_CDN = `https://cdn.jsdelivr.net/npm/@uswds/uswds@${USWDS_VERSION}/dist`;
const SHEET_TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1ysiHznH64SB9CjedjVnZOg5YkMrPyYofSAXXHXa0w0I/copy';

export function generateSetupPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evergreen — Pre-Deployment AI Eval</title>
  <script src="${USWDS_CDN}/js/uswds-init.min.js"></script>
  <link rel="stylesheet" href="${USWDS_CDN}/css/uswds.min.css" />
  <style>
    .ev-progress { display: none; margin-top: 2rem; }
    .ev-progress.visible { display: block; }
    .ev-result { display: none; margin-top: 1.5rem; }
    .ev-result.visible { display: block; }
    .ev-guide-section { margin-bottom: 1.5rem; }
    .ev-guide-section h4 { margin-bottom: 0.5rem; }
    .ev-guide-table { font-size: 0.875rem; }
    .ev-guide-table td, .ev-guide-table th { padding: 0.4rem 0.6rem; }
  </style>
</head>
<body>

  <!-- USWDS Banner -->
  <section class="usa-banner" aria-label="Official demonstration">
    <div class="usa-accordion">
      <header class="usa-banner__header">
        <div class="usa-banner__inner">
          <div class="grid-col-auto">
            <img aria-hidden="true" class="usa-banner__header-flag" src="${USWDS_CDN}/../img/us_flag_small.png" alt="" />
          </div>
          <div class="grid-col-fill tablet:grid-col-auto" aria-hidden="true">
            <p class="usa-banner__header-text">An evaluation tool for public sector AI systems</p>
          </div>
        </div>
      </header>
    </div>
  </section>

  <!-- Header -->
  <header class="usa-header usa-header--basic">
    <div class="usa-nav-container">
      <div class="usa-navbar">
        <div class="usa-logo">
          <em class="usa-logo__text">
            <a href="/" title="Evergreen">Evergreen</a>
          </em>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main id="main-content">
    <div class="grid-container">

      <div class="grid-row grid-gap margin-top-4">
        <div class="grid-col-12">
          <h1 class="font-heading-xl margin-bottom-1">Pre-Deployment AI Evaluation</h1>
          <p class="usa-intro">Test whether your AI system gives safe, accurate answers before you deploy it.</p>
        </div>
      </div>

      <div class="grid-row grid-gap margin-top-3">

        <!-- Left column: Form -->
        <div class="tablet:grid-col-8">
          <form class="usa-form usa-form--large" id="eval-form" onsubmit="return false;">

            <label class="usa-label" for="description">Evaluation name</label>
            <input class="usa-input" id="description" name="description" type="text"
              value="My AI Chatbot — Pre-Deployment Eval" />

            <label class="usa-label margin-top-3" for="sheet-url">Google Sheet URL</label>
            <span class="usa-hint">
              Paste the full URL of your test case sheet.
              <a href="${SHEET_TEMPLATE_URL}" target="_blank" class="usa-link">Copy the template</a> if you don't have one.
            </span>
            <input class="usa-input" id="sheet-url" name="sheetUrl" type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..." required />

            <label class="usa-label margin-top-3" for="provider">LLM provider to test</label>
            <select class="usa-select" id="provider" name="provider">
              <option value="openai:gpt-4o">OpenAI GPT-4o</option>
              <option value="openai:gpt-4o-mini">OpenAI GPT-4o-mini</option>
              <option value="anthropic:claude-sonnet-4-20250514">Anthropic Claude Sonnet</option>
              <option value="anthropic:claude-haiku-4-5-20251001">Anthropic Claude Haiku</option>
            </select>

            <label class="usa-label margin-top-3" for="system-prompt">System prompt</label>
            <span class="usa-hint">Instructions the AI system should follow when answering questions.</span>
            <textarea class="usa-textarea" id="system-prompt" name="systemPrompt" rows="4">You are a helpful assistant. Answer in plain language at a 6th grade reading level.</textarea>

            <button class="usa-button margin-top-3" id="run-btn" type="button" onclick="submitEval()">
              Run Evaluation
            </button>
          </form>

          <!-- Step Indicator (hidden until running) -->
          <div class="ev-progress" id="progress-section">
            <div class="usa-step-indicator usa-step-indicator--counters" aria-label="progress">
              <ol class="usa-step-indicator__segments">
                <li class="usa-step-indicator__segment" id="step-fetch">
                  <span class="usa-step-indicator__segment-label">Fetch sheet</span>
                </li>
                <li class="usa-step-indicator__segment" id="step-config">
                  <span class="usa-step-indicator__segment-label">Generate config</span>
                </li>
                <li class="usa-step-indicator__segment" id="step-eval">
                  <span class="usa-step-indicator__segment-label">Run evaluations</span>
                </li>
                <li class="usa-step-indicator__segment" id="step-report">
                  <span class="usa-step-indicator__segment-label">Generate report</span>
                </li>
              </ol>
              <div class="usa-step-indicator__header">
                <h4 class="usa-step-indicator__heading">
                  <span class="usa-step-indicator__heading-counter">
                    <span class="usa-sr-only">Step</span>
                    <span class="usa-step-indicator__current-step" id="current-step-num">1</span>
                    <span class="usa-step-indicator__total-steps">of 4</span>
                  </span>
                  <span id="step-message">Fetching test cases from Google Sheet...</span>
                </h4>
              </div>
            </div>
          </div>

          <!-- Success result -->
          <div class="ev-result" id="result-success">
            <div class="usa-alert usa-alert--success usa-alert--slim">
              <div class="usa-alert__body">
                <h4 class="usa-alert__heading">Evaluation complete!</h4>
                <p class="usa-alert__text">
                  Your report is ready.
                  <a href="/report" class="usa-link" target="_blank">View the full report</a>
                </p>
              </div>
            </div>
          </div>

          <!-- Error result -->
          <div class="ev-result" id="result-error">
            <div class="usa-alert usa-alert--error usa-alert--slim">
              <div class="usa-alert__body">
                <h4 class="usa-alert__heading">Evaluation failed</h4>
                <p class="usa-alert__text" id="error-message"></p>
              </div>
            </div>
          </div>

        </div>

        <!-- Right column: Guide -->
        <div class="tablet:grid-col-4">

          <div class="ev-guide-section">
            <h3 class="font-heading-md">How it works</h3>
            <ol class="usa-process-list">
              <li class="usa-process-list__item">
                <h4 class="usa-process-list__heading">Create test cases</h4>
                <p>Write questions and expected answers in a Google Sheet.</p>
              </li>
              <li class="usa-process-list__item">
                <h4 class="usa-process-list__heading">Share the sheet</h4>
                <p>Set it to "Anyone with the link can view."</p>
              </li>
              <li class="usa-process-list__item">
                <h4 class="usa-process-list__heading">Run the evaluation</h4>
                <p>Paste the URL above, pick your AI provider, and click Run.</p>
              </li>
              <li class="usa-process-list__item">
                <h4 class="usa-process-list__heading">Review the report</h4>
                <p>Read what passed, what failed, and whether the system is ready to deploy.</p>
              </li>
            </ol>
          </div>

          <div class="usa-summary-box" role="region" aria-labelledby="check-types-heading">
            <div class="usa-summary-box__body">
              <h4 class="usa-summary-box__heading" id="check-types-heading">Sheet columns</h4>
              <div class="usa-summary-box__text">
                <table class="usa-table usa-table--borderless ev-guide-table">
                  <thead><tr><th>Column</th><th>What goes here</th></tr></thead>
                  <tbody>
                    <tr><td><strong>Question</strong></td><td>What a real person would ask</td></tr>
                    <tr><td><strong>Expected Answer</strong></td><td>What the response must include</td></tr>
                    <tr><td><strong>Context</strong></td><td>Situation that changes the answer (optional)</td></tr>
                    <tr><td><strong>Check Type</strong></td><td>contains, not-contains, contains-all, llm-rubric</td></tr>
                    <tr><td><strong>Severity</strong></td><td>critical, high, medium, low</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  </main>

  <!-- Footer -->
  <footer class="usa-footer usa-footer--slim">
    <div class="grid-container">
      <div class="usa-footer__return-to-top">
        <a href="#">Return to top</a>
      </div>
    </div>
    <div class="usa-footer__primary-section">
      <div class="grid-container">
        <div class="usa-footer__primary-container grid-row">
          <div class="grid-col-12">
            <span class="usa-footer__primary-content">
              Powered by <a href="https://github.com/promptfoo/promptfoo" class="usa-link" target="_blank">Promptfoo</a>
              &middot; Apache 2.0 License
            </span>
          </div>
        </div>
      </div>
    </div>
  </footer>

  <script src="${USWDS_CDN}/js/uswds.min.js"></script>
  <script>
    var pollTimer = null;

    function submitEval() {
      var sheetUrl = document.getElementById('sheet-url').value.trim();
      if (!sheetUrl || !sheetUrl.includes('/spreadsheets/d/')) {
        alert('Please enter a valid Google Sheets URL (must contain /spreadsheets/d/)');
        return;
      }

      // Disable form
      document.getElementById('run-btn').disabled = true;
      document.getElementById('run-btn').textContent = 'Running...';
      document.getElementById('result-success').classList.remove('visible');
      document.getElementById('result-error').classList.remove('visible');
      document.getElementById('progress-section').classList.add('visible');

      // Reset step indicator
      var steps = ['step-fetch', 'step-config', 'step-eval', 'step-report'];
      steps.forEach(function(id) {
        var el = document.getElementById(id);
        el.classList.remove('usa-step-indicator__segment--complete', 'usa-step-indicator__segment--current');
      });
      document.getElementById('step-fetch').classList.add('usa-step-indicator__segment--current');

      fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetUrl: sheetUrl,
          description: document.getElementById('description').value.trim(),
          provider: document.getElementById('provider').value,
          systemPrompt: document.getElementById('system-prompt').value.trim()
        })
      }).then(function(res) {
        if (!res.ok) throw new Error('Server error');
        pollTimer = setInterval(pollStatus, 1000);
      }).catch(function(err) {
        showError('Could not connect to server: ' + err.message);
      });
    }

    var STEP_ORDER = ['fetch', 'config', 'eval', 'report', 'done'];

    function pollStatus() {
      fetch('/api/status').then(function(res) {
        return res.json();
      }).then(function(data) {
        updateSteps(data.step);
        document.getElementById('step-message').textContent = data.message || '';

        if (data.status === 'done') {
          clearInterval(pollTimer);
          document.getElementById('result-success').classList.add('visible');
          document.getElementById('progress-section').classList.remove('visible');
          resetForm();
        } else if (data.status === 'error') {
          clearInterval(pollTimer);
          showError(data.error || 'Unknown error');
        }
      }).catch(function() {
        // Ignore transient poll failures
      });
    }

    function updateSteps(currentStep) {
      var stepIdx = STEP_ORDER.indexOf(currentStep);
      var stepEls = ['step-fetch', 'step-config', 'step-eval', 'step-report'];
      var stepNum = Math.min(stepIdx + 1, 4);
      document.getElementById('current-step-num').textContent = String(stepNum);

      stepEls.forEach(function(id, i) {
        var el = document.getElementById(id);
        el.classList.remove('usa-step-indicator__segment--complete', 'usa-step-indicator__segment--current');
        if (i < stepIdx) {
          el.classList.add('usa-step-indicator__segment--complete');
        } else if (i === stepIdx) {
          el.classList.add('usa-step-indicator__segment--current');
        }
      });
    }

    function showError(msg) {
      document.getElementById('error-message').textContent = msg;
      document.getElementById('result-error').classList.add('visible');
      document.getElementById('progress-section').classList.remove('visible');
      resetForm();
    }

    function resetForm() {
      document.getElementById('run-btn').disabled = false;
      document.getElementById('run-btn').textContent = 'Run Evaluation';
    }
  </script>

</body>
</html>`;
}
