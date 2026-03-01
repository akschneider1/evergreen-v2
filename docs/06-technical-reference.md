# Technical Reference

Configuration options, CLI flags, and details for technical implementers.

---

## CLI Usage

### `evergreen run`

Fetch test cases, run evaluations, and generate the HTML report.

```bash
npx evergreen run [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `-c`, `--config` | `evergreen.yaml` | Path to Evergreen config file |
| `-o`, `--output` | `report.html` | Path for the HTML report output |
| `-h`, `--help` | — | Show usage information |

```bash
# Run with defaults
npx evergreen run

# Specify a config file
npx evergreen run -c examples/co-tax-policy/evergreen.yaml

# Specify output path
npx evergreen run -o results/my-eval-report.html
```

### `evergreen serve`

Start a local HTTP server to view the report in a browser.

```bash
npx evergreen serve [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o`, `--output` | `report.html` | Path to the report file to serve |
| `-p`, `--port` | `4000` | Port to listen on |

```bash
# Serve the default report on port 4000
npx evergreen serve

# Serve a specific report file
npx evergreen serve -o results/my-eval-report.html

# Use a different port
npx evergreen serve -p 3000
```

Open **http://localhost:4000** (or your chosen port) in any browser. Press `Ctrl+C` to stop.

> `evergreen serve` requires `report.html` to already exist. Run `evergreen run` first.

### `evergreen app`

Launch the unified web app — an Express server that combines the input form and the report viewer in one browser session. No config file required.

```bash
npx evergreen app [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `-p`, `--port` | `4000` | Port to listen on |

```bash
# Launch on the default port
npx evergreen app

# Launch on a custom port
npx evergreen app -p 3000
```

Open **http://localhost:4000** in your browser. The landing page shows an overview, template library, and links to the Builder and Run form.

**Pages:**

| Path | Description |
|------|-------------|
| `/` | Landing page — hero, how it works, template cards, regression testing guidance |
| `/builder` | Test Suite Builder — browse templates, create/edit test cases, export CSV |
| `/run` | Eval runner form — select test cases + provider, run evaluation |
| `/report/:jobId` | Completed report (generated after eval) |

**Run form fields** (`/run`):

| Field | Required | Description |
|-------|----------|-------------|
| Evaluation name | No | A human-readable label for this run |
| Test cases | Yes | Choose "My Google Sheet" (paste a URL) or "Built-in test suite" (select a preset) |
| AI use case | When using Google Sheet | Select the use case category for the AI being tested |
| LLM provider | Yes | Selected from a dropdown; same providers as `evergreen run` |
| Agency name | No | Your agency (appears in report header) |
| Evaluator name | No | Your name (appears in report header) |
| Reason for evaluation | No | Initial, post-update, or periodic (appears in report header) |

The server runs the same four-step pipeline as `evergreen run` (fetch → config → eval → report). When the pipeline completes, the report is served at `/report/:jobId` on the same server — no separate `evergreen serve` needed. Each report is held in memory for the lifetime of the server process.

**API endpoints (for integration or debugging):**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Landing page (HTML) |
| `GET` | `/builder` | Test Suite Builder (HTML) |
| `GET` | `/run` | Eval runner form (HTML) |
| `GET` | `/api/templates` | List all template presets (JSON); returns `[{ id, name, icon, domain, caseCount, description, metricDistribution }]` |
| `GET` | `/api/templates/:id` | Get a single template with builder cases (JSON) |
| `POST` | `/api/export-sheet` | Export builder cases as CSV; body: `{ cases: BuilderTestCase[] }` |
| `POST` | `/api/run` | Start a job; body: `{ provider, description?, sheetUrl?, aiDescription?, presetId?, agencyName?, evaluatorName?, evaluationReason? }`; returns `{ jobId }` |
| `GET` | `/api/status/:jobId` | Poll job progress; returns `{ step, status, error? }` |
| `GET` | `/report/:jobId` | Serve completed report HTML |

---

## Config File (evergreen.yaml)

The config file tells Evergreen where to find test cases and what to test.

```yaml
# Required
description: "CO Tax Policy Chatbot — Pre-Deployment Eval"
sheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
providers:
  - id: openai:gpt-4o

# Optional
defaultSystemPrompt: |
  You are a helpful assistant for Colorado tax questions.
  Answer in plain language at a 6th grade reading level.
llmRubricProvider: "openai:gpt-4o"
outputPath: "./results.json"
```

### Config Fields

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | Human-readable name for this evaluation |
| `sheetId` | Yes | Google Sheet ID (from the URL after `/d/`) |
| `providers` | Yes | Array of LLM providers to test against |
| `defaultSystemPrompt` | No | System prompt applied to all providers (unless overridden) |
| `llmRubricProvider` | No | Provider used for `llm-rubric` grading (defaults to first provider) |
| `outputPath` | No | Path for Promptfoo's raw JSON output (default: `./results.json`) |

### Provider Configuration

Providers can be specified as simple strings or objects with a system prompt:

```yaml
# Simple — uses defaultSystemPrompt
providers:
  - openai:gpt-4o

# With provider-specific system prompt
providers:
  - id: openai:gpt-4o
    systemPrompt: |
      You are a Colorado tax assistant.
      Answer in plain language.

  - id: anthropic:messages:claude-sonnet-4-20250514
    systemPrompt: |
      You are a Colorado tax assistant.
      Be concise and cite specific rules.
```

### Supported Providers

Evergreen supports any provider that Promptfoo supports. Common ones:

| Provider | Config ID |
|----------|-----------|
| OpenAI GPT-4o | `openai:gpt-4o` |
| OpenAI GPT-4o-mini | `openai:gpt-4o-mini` |
| OpenAI GPT-4-turbo | `openai:gpt-4-turbo` |
| Anthropic Claude 4 Opus | `anthropic:messages:claude-opus-4-20250514` |
| Anthropic Claude 4 Sonnet | `anthropic:messages:claude-sonnet-4-20250514` |
| Anthropic Claude Haiku | `anthropic:messages:claude-haiku-4-5-20251001` |

> **Anthropic note:** The `anthropic:messages:` prefix is required. Using `anthropic:` alone (without `messages:`) will cause a provider error.

See [Promptfoo's provider docs](https://www.promptfoo.dev/docs/providers/) for the full list, including Azure, Google, AWS Bedrock, local models, and custom API endpoints.

---

## Google Sheet Format

The Google Sheet must have these five columns in order. **Row 1 is the header. Row 2 is a pre-filled example row** that explains each column to sheet editors — it is automatically skipped and never used as a test case. **Test cases start at row 3.**

| Column | Name | Required |
|--------|------|----------|
| A | Question | Yes |
| B | What to Check | Yes |
| C | Context | No (can be blank) |
| D | Metric | Yes |
| E | Severity | Yes |

### Metric Values

| Value in Sheet | How Evergreen Grades It |
|----------------|------------------------|
| `Safety` | LLM judge checks that the response does NOT make the described claim |
| `Accuracy` | Case-insensitive check that the text in "What to Check" appears in the response; comma-separated values each become a separate required match |
| `Effectiveness` | LLM judge evaluates whether the response genuinely helps the person in their situation |
| `Ease of Use` | LLM judge evaluates plain language, clarity, and readability for a non-expert |
| `Emotion` | LLM judge evaluates tone, empathy, and appropriate handling of sensitive situations |

The tool accepts common capitalization variants (`safety`, `SAFETY`, `Ease of Use`, `ease-of-use`). Unknown values default to `Accuracy` with a warning logged.

> **Power-user option:** Within the `Accuracy` metric, prefix the value in "What to Check" with `regex:` to use a regular expression instead of a literal match. For example, `regex:4\.4%|four point four` matches either form.

### Severity Levels

| Value | Meaning |
|-------|---------|
| `critical` | Wrong answer causes real harm |
| `high` | Wrong answer is seriously misleading |
| `medium` | Wrong answer is unhelpful |
| `low` | Minor quality issue |

> **Safety note:** All Safety failures block deployment regardless of severity.

---

## Environment Variables

| Variable | Required For | Description |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | OpenAI providers | Your OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic providers | Your Anthropic API key |

---

## How It Works Under the Hood

Both `npx evergreen run` and `npx evergreen app` execute the same four-step pipeline:

```
1. FETCH    Google Sheet → SheetRow[]  (src/sheets.ts)
            or: Built-in preset rows   (src/presets/)
2. GENERATE SheetRow[] → Promptfoo YAML          (src/config.ts)
3. EVAL     Promptfoo CLI → JSON results          (src/runner.ts)
4. REPORT   JSON → EvalResults → HTML             (src/mapper.ts + src/report/generator.ts)
```

The difference: `evergreen run` runs the pipeline synchronously in the terminal; `evergreen app` runs it asynchronously in a background job and serves the result over HTTP.

### Step 1: Fetch
Fetches the Google Sheet as a CSV export (no API key needed — the sheet just needs to be publicly viewable) and parses it into typed `SheetRow` objects. When using a built-in test suite (`presetId`), loads the bundled rows directly from `src/presets/` instead.

**Built-in test suites:**

| ID | Name | Cases | Domain |
|----|------|-------|--------|
| `wheres-my-refund` | Where's My Refund | 25 | Revenue |
| `benefits-eligibility` | Benefits Eligibility | 25 | Benefits |
| `snap-food-assistance` | SNAP / Food Assistance | 25 | Benefits |
| `agent-assist` | Agent Assist | 25 | Support |
| `call-center-summaries` | Call Center Summaries | 25 | Support |
| `permitting-assistant` | Permitting Assistant | 25 | Licensing |

### Step 2: Generate
Converts the sheet rows + your `evergreen.yaml` config into a Promptfoo-compatible YAML config file. This is written to `.promptfoo-config.yaml` (temporary, deleted after run).

### Step 3: Eval
Invokes `npx promptfoo eval` as a subprocess. Promptfoo handles sending prompts to LLM providers, running assertions, and writing JSON results.

### Step 4: Report
Maps Promptfoo's JSON output to the report generator's input format, then renders a single-file HTML report with four tabs (Summary, Analysis, Details, Recommendations).

---

## Extending

### Testing Against a Custom API

If your AI system isn't a direct LLM call but a custom API endpoint, use Promptfoo's webhook provider:

```yaml
providers:
  - id: webhook:https://your-api.example.com/chat
    config:
      method: POST
      headers:
        Authorization: "Bearer {{env.MY_API_KEY}}"
      body:
        message: "{{question}}"
      responseParser: "json.response.text"
```

### Adding Custom Assertion Logic

For complex grading beyond what `contains` or `llm-rubric` provides, you can write a custom Promptfoo assertion in JavaScript. See [Promptfoo's custom assertions docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/).

---

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| Sheet fetch returns 404 | Sheet ID is wrong or sheet isn't shared | Check the URL and sharing settings |
| Sheet fetch returns HTML instead of CSV | Google returned a login page | Set sheet to "Anyone with the link can view" |
| Anthropic "unknown model type" error | Missing `messages:` prefix | Use `anthropic:messages:claude-sonnet-4-20250514` |
| Promptfoo errors about provider | Invalid provider ID or missing API key | Check provider ID spelling and env vars |
| Promptfoo timeout | LLM provider is slow or unreachable | Check network, try again, or increase timeout |
| Report shows "(no response)" | LLM returned empty or Promptfoo errored | Check Promptfoo's console output for details |
| Safety / Effectiveness / Ease of Use / Emotion tests all fail | No judge provider configured | Set `llmRubricProvider` in config, or ensure your API key is set |
| `evergreen serve` — "Report not found" | `report.html` doesn't exist yet | Run `evergreen run` first to generate it |
| `evergreen serve` — "address already in use" | Another process is on port 4000 | Use `-p 3001` (or any free port) |
| `evergreen app` — "address already in use" | Port 4000 is taken | Use `evergreen app -p 3001` |
| `evergreen app` — report link 404 | Server was restarted; reports live in memory only | Re-run the evaluation |
| `evergreen app` — provider not in dropdown | You need a provider not shown | Use `evergreen run` with a custom `evergreen.yaml` |
