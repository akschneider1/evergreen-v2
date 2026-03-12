# Quickstart Guide

Get from zero to your first evaluation report in under 10 minutes.

There are two ways to run Evergreen:

| | **Web App** | **CLI** |
|--|------------|---------|
| Config file needed? | No — use the browser form | Yes — `evergreen.yaml` |
| Test cases | Library template, Builder, or Google Sheet | Google Sheet (required) |
| Best for | Non-technical users; one-off runs | Scripting, automation, CI/CD |
| Command | `npx evergreen app` | `npx evergreen run` |

---

## What You'll Need

| Item | Who Provides It |
|------|----------------|
| Node.js 20 or later installed | Your technical colleague |
| An API key for the LLM you're testing (e.g., OpenAI) | Your technical colleague |
| A Google account (only if bringing your own Google Sheet) | You |

---

## Option A: Web App (recommended)

No config file needed. Everything is entered through the browser.

### Step 1A: Set Your API Key

```bash
# For OpenAI
export OPENAI_API_KEY=sk-your-key-here

# For Anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 2A: Launch the Web App

```bash
npx evergreen app
```

Open **http://localhost:4000** in your browser.

### Step 3A: Get Test Cases

Choose one of three paths:

**Path 1 — Library template (fastest)**

Pick a pre-built test suite (25 tests each) from the landing page. Click **"Run now"** on any template card to jump straight to the run form with that suite pre-selected.

> **Personas and multi-turn conversations:** Some test suites — like **Permitting Assistant** — test how the AI responds to the same question from different types of people. For example, a homeowner, a renter, and a contractor may ask about the same permit requirement but each need a slightly different answer. Each "persona" gives the AI a short conversation history before the graded question, so you're testing how it handles real-world context. Persona-based test cases are only available in the built-in presets — you can't add them manually in Google Sheets or the Builder.

**Path 2 — Build your own in the Builder**

Click **"Get started →"** or **"Open in Builder"** on any template card to open the Test Suite Builder at `/builder`. In the **Library** tab, pick a starting point — or click "Start building →" to start from scratch. In the **Builder** tab, review and edit test cases, or add new ones. Each case gets a question, a metric (Safety, Accuracy, Ease of Use, Effectiveness, or Emotion), criteria for what the AI should or shouldn't say, and a severity level. When you're ready, click **"Run Evaluation →"** to move to the run form.

**Path 3 — Bring a Google Sheet**

If you've already written test cases in a Google Sheet:

1. Set up the sheet with 5 columns: `Question` | `What to Check` | `Context` | `Metric` | `Severity`
   - Row 1 = header, row 2 = a pre-filled example row (auto-skipped), test cases start at row 3
   - See [Writing Test Cases](./03-writing-test-cases.md) for column-by-column guidance
2. Click **Share** → set "General access" to **"Anyone with the link"** → **Viewer** → copy the full URL
3. On the run form, select **"My Google Sheet"** and paste the URL

### Step 4A: Run the Evaluation

On the run form (`/run`), fill in the remaining fields:

| Field | What to Enter |
|-------|--------------|
| **Evaluation name** | A label for this run, e.g. "CO Tax Chatbot — March 2026" |
| **LLM provider** | Select from the dropdown (Claude Sonnet 4 is recommended) |

**Optional — Evaluation context** (click to expand):

| Field | What to Enter |
|-------|--------------|
| **Agency name** | Your agency or department name |
| **Evaluator name** | Your name (appears in the report header) |
| **Reason for evaluation** | Initial evaluation, post-update re-evaluation, or periodic review |

Click **Run Evaluation**. A step-by-step progress indicator tracks the pipeline:

1. Load test cases
2. Generate evaluation config
3. Run AI evaluations
4. Generate report

When complete, a success banner appears with a **View the report →** link.

### Optional: Langfuse observability

If you have a [Langfuse](https://langfuse.com) account, set `LANGFUSE_SECRET_KEY` and `LANGFUSE_PUBLIC_KEY` before launching the app. A "Send to Langfuse" checkbox will appear on the Run form. After the evaluation completes, a "View in Langfuse" link takes you to the full trace — pipeline spans, per-test prompts and responses, automatic scores (pass/fail, metric, severity), and thumbs up/down feedback you submit from inside the report.

```bash
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_PUBLIC_KEY=pk-lf-...
npx evergreen app
```

---

## Option B: CLI

Use this path if you want a config file you can version-control or run in CI/CD. The CLI always reads test cases from a Google Sheet.

### Step 1B: Set Up Your Google Sheet

1. Open the [Evergreen Test Case Template](https://docs.google.com/spreadsheets/d/1ysiHznH64SB9CjedjVnZOg5YkMrPyYofSAXXHXa0w0I/copy)
2. Click **"Make a copy"** and rename it for your project (e.g. "CO Tax Chatbot — Eval Test Cases")
3. Add your test cases — 5 columns: `Question` | `What to Check` | `Context` | `Metric` | `Severity`
   - Row 1 = header, row 2 = example (auto-skipped), test cases start at row 3
4. Click **Share** → "Anyone with the link" → **Viewer** → copy the URL

See [Writing Test Cases](./03-writing-test-cases.md) for detailed guidance.

### Step 2B: Create the Config File

Create a file called `evergreen.yaml` in your project folder:

```yaml
description: "My AI Chatbot — Pre-Deployment Eval"

sheetId: "YOUR_SHEET_ID_HERE"

providers:
  - id: openai:gpt-4o
    systemPrompt: |
      You are a helpful assistant for [your domain] questions.
      Answer in plain language.
```

Replace:
- `YOUR_SHEET_ID_HERE` with the long string between `/d/` and `/edit` in the Sheet URL
- `openai:gpt-4o` with whichever LLM you're testing
- The system prompt with whatever your AI system uses

**Common providers:**

| Provider | ID |
|----------|-----|
| OpenAI GPT-4o | `openai:gpt-4o` |
| OpenAI GPT-4o-mini | `openai:gpt-4o-mini` |
| Anthropic Claude Sonnet 4 | `anthropic:messages:claude-sonnet-4-20250514` |
| Anthropic Claude Haiku 4.5 | `anthropic:messages:claude-haiku-4-5-20251001` |
| Anthropic Claude Opus 4.5 | `anthropic:messages:claude-opus-4-5` |

### Step 3B: Set Your API Key

```bash
# For OpenAI
export OPENAI_API_KEY=sk-your-key-here

# For Anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 4B: Run the Evaluation

```bash
npx evergreen run
```

You'll see progress in the terminal:

```
┌─────────────────────────────────────────┐
│  Evergreen — Pre-Deployment AI Eval     │
└─────────────────────────────────────────┘

Config:    evergreen.yaml
Sheet ID:  1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
Providers: openai:gpt-4o

Step 1/4 — Fetching test cases from Google Sheet...
  Found 10 test cases.

Step 2/4 — Generating Promptfoo config...
  Written to .promptfoo-config.yaml

Step 3/4 — Running evaluations...
  ...

Step 4/4 — Generating report...
  Report written to report.html

┌─────────────────────────────────────────┐
│  Done! Open the report in your browser: │
│  report.html                            │
└─────────────────────────────────────────┘
```

### Step 5B: View the Report

```bash
npx evergreen serve
```

Open **http://localhost:4000** in your browser. Press `Ctrl+C` to stop.

Alternatively, open `report.html` directly as a file. See [Understanding Results](./04-understanding-results.md) for how to read the report.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Failed to fetch Google Sheet" | Make sure the sheet is shared as "Anyone with the link can view" |
| "API key is missing" | Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in your terminal |
| "Config file not found" | Make sure `evergreen.yaml` is in the folder where you run the command |
| "No valid test cases found" | Check your Sheet has the 5 required columns (`Question`, `What to Check`, `Context`, `Metric`, `Severity`) with data starting in **row 3** (row 1 = header, row 2 = example) |
| "Report not found" when running `serve` | Run `npx evergreen run` first to generate the report |
| Anthropic provider error about unknown model type | Use the `anthropic:messages:` prefix, e.g. `anthropic:messages:claude-sonnet-4-20250514` |

---

## Next Steps

- [Writing Test Cases](./03-writing-test-cases.md) — write effective evaluations
- [Understanding Results](./04-understanding-results.md) — read and act on the report
- [Technical Reference](./06-technical-reference.md) — all CLI flags and config options
