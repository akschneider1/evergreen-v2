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

Open **http://localhost:4000** in your browser. The form accepts:

| Field | Required | Description |
|-------|----------|-------------|
| Evaluation name | No | A human-readable label for this run |
| Google Sheet URL | Yes | Full browser URL — the app extracts the Sheet ID automatically |
| LLM provider | Yes | Selected from a dropdown; same providers as `evergreen run` |
| System prompt | No | Instructions given to the AI before each question |

The server runs the same four-step pipeline as `evergreen run` (fetch → config → eval → report). When the pipeline completes, the report is served at `/report/:jobId` on the same server — no separate `evergreen serve` needed. Each report is held in memory for the lifetime of the server process.

**API endpoints (for integration or debugging):**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Input form (HTML) |
| `POST` | `/api/run` | Start a job; body: `{ sheetUrl, provider, description?, systemPrompt? }`; returns `{ jobId }` |
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

  - id: anthropic:claude-sonnet-4-20250514
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
| B | Expected Answer | Yes |
| C | Context | No (can be blank) |
| D | Check Type | Yes |
| E | Severity | Yes |

### Check Types

| Value in Sheet | Promptfoo Assertion | Behavior |
|---------------|-------------------|----------|
| `contains` | `contains` | Response must include the exact text |
| `not-contains` | `not-contains` | Response must NOT include the text |
| `contains-all` | Multiple `contains` | Each comma-separated item must appear (all must match) |
| `regex` | `regex` | Response must match the regular expression |
| `llm-rubric` | `llm-rubric` | An LLM judge scores against the description |

### Severity Levels

| Value | Meaning |
|-------|---------|
| `critical` | Wrong answer causes real harm |
| `high` | Wrong answer is seriously misleading |
| `medium` | Wrong answer is unhelpful |
| `low` | Minor quality issue |

The tool accepts common typos and aliases (e.g., `not_contains`, `containsAll`, `rubric`).

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
1. FETCH    Google Sheet → CSV → SheetRow[]     (src/sheets.ts)
2. GENERATE SheetRow[] → Promptfoo YAML          (src/config.ts)
3. EVAL     Promptfoo CLI → JSON results          (src/runner.ts)
4. REPORT   JSON → EvalResults → HTML             (src/mapper.ts + src/report/generator.ts)
```

The difference: `evergreen run` runs the pipeline synchronously in the terminal; `evergreen app` runs it asynchronously in a background job and serves the result over HTTP.

### Step 1: Fetch
Fetches the Google Sheet as a CSV export (no API key needed — the sheet just needs to be publicly viewable). Parses the CSV into typed `SheetRow` objects.

### Step 2: Generate
Converts the sheet rows + your `evergreen.yaml` config into a Promptfoo-compatible YAML config file. This is written to `.promptfoo-config.yaml` (temporary, deleted after run).

### Step 3: Eval
Invokes `npx promptfoo eval` as a subprocess. Promptfoo handles sending prompts to LLM providers, running assertions, and writing JSON results.

### Step 4: Report
Maps Promptfoo's JSON output to the report generator's input format, then renders a single-file HTML report with three tabs (Summary, Analysis, Details).

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
| All `llm-rubric` tests fail | No judge provider configured | Set `llmRubricProvider` in config |
| `evergreen serve` — "Report not found" | `report.html` doesn't exist yet | Run `evergreen run` first to generate it |
| `evergreen serve` — "address already in use" | Another process is on port 4000 | Use `-p 3001` (or any free port) |
| `evergreen app` — "address already in use" | Port 4000 is taken | Use `evergreen app -p 3001` |
| `evergreen app` — report link 404 | Server was restarted; reports live in memory only | Re-run the evaluation |
| `evergreen app` — provider not in dropdown | You need a provider not shown | Use `evergreen run` with a custom `evergreen.yaml` |
