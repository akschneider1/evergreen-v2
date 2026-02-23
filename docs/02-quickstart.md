# Quickstart Guide

Get from zero to your first evaluation report in under 10 minutes.

There are two ways to run Evergreen:

| | **Web App** | **CLI** |
|--|------------|---------|
| Config file needed? | No — use the browser form | Yes — `evergreen.yaml` |
| Sheet input | Paste the full URL | Copy the Sheet ID |
| Best for | Non-technical users; one-off runs | Scripting, automation, CI/CD |
| Command | `npx evergreen app` | `npx evergreen run` |

---

## What You'll Need

| Item | Who Provides It |
|------|----------------|
| A Google account (to copy the Sheet template) | You |
| Node.js 18 or later installed | Your technical colleague |
| An API key for the LLM you're testing (e.g., OpenAI) | Your technical colleague |

---

## Step 1: Copy the Google Sheet Template

1. Open the [Evergreen Test Case Template](https://docs.google.com/spreadsheets/d/1ysiHznH64SB9CjedjVnZOg5YkMrPyYofSAXXHXa0w0I/copy)
2. Click **"Make a copy"**
3. Rename it for your project (e.g., "CO Tax Chatbot — Eval Test Cases")

The template has five columns:

| Column | What Goes Here |
|--------|---------------|
| **Question** | A question someone would ask the AI |
| **Expected Answer** | What a correct response should include |
| **Context** | Any situation that affects the correct answer (optional) |
| **Check Type** | How to judge the response (`contains`, `llm-rubric`, etc.) |
| **Severity** | How bad is it if the AI gets this wrong? (`critical`, `high`, `medium`, `low`) |

> **Note:** Row 1 is the header. Row 2 is a pre-filled example row that explains each column — leave it in place, it won't be included in the evaluation. Your test cases start at **row 3**.

See [Writing Test Cases](./03-writing-test-cases.md) for detailed guidance.

---

## Step 2: Share the Sheet

1. Click the **Share** button in your Google Sheet
2. Under "General access", change to **"Anyone with the link"**
3. Set permission to **"Viewer"**
4. Copy the full URL from your browser's address bar (you'll need it in the next step)

---

## Option A: Web App

No config file needed. Everything is entered through the browser.

### Step 3A: Set Your API Key

```bash
# For OpenAI
export OPENAI_API_KEY=sk-your-key-here

# For Anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 4A: Launch the Web App

```bash
npx evergreen app
```

Open **http://localhost:4000** in your browser.

### Step 5A: Fill In the Form

| Field | What to Enter |
|-------|--------------|
| **Evaluation name** | A label for this run, e.g. "CO Tax Chatbot — March 2026" |
| **Google Sheet URL** | Paste the full link from your browser |
| **LLM provider** | Select from the dropdown (Claude Sonnet is recommended) |
| **System prompt** | The instructions your AI uses before each question (optional) |

Click **Run Evaluation**. A step-by-step progress indicator tracks the pipeline:
1. Fetch test cases from Google Sheet
2. Generate evaluation config
3. Run AI evaluations
4. Generate report

When complete, a success banner appears with a **View the report →** link.

---

## Option B: CLI

Use this path if you want a config file you can version-control or run in CI/CD.

### Step 3B: Create the Config File

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
| Anthropic Claude Sonnet | `anthropic:messages:claude-sonnet-4-20250514` |
| Anthropic Claude Haiku | `anthropic:messages:claude-haiku-4-5-20251001` |

### Step 4B: Set Your API Key

```bash
# For OpenAI
export OPENAI_API_KEY=sk-your-key-here

# For Anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 5B: Run the Evaluation

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

### Step 6B: View the Report

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
| "No valid test cases found" | Check your Sheet has the 5 required columns with data starting in **row 3** (row 1 = header, row 2 = example) |
| "Report not found" when running `serve` | Run `npx evergreen run` first to generate the report |
| Anthropic provider error about unknown model type | Use the `anthropic:messages:` prefix, e.g. `anthropic:messages:claude-sonnet-4-20250514` |

---

## Next Steps

- [Writing Test Cases](./03-writing-test-cases.md) — write effective evaluations
- [Understanding Results](./04-understanding-results.md) — read and act on the report
- [Technical Reference](./06-technical-reference.md) — all CLI flags and config options
