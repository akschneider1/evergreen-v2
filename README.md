# Evergreen

**Pre-deployment AI evaluation for government — by the people closest to the problem.**

---

You're deploying an AI tool — a chatbot, a benefits navigator, a case assistant — and you need to know it gives the right answers before real people use it. Evergreen lets you check. You define what a good response looks like; Evergreen tests whether your AI delivers it. The result is a plain-language report with a deployment recommendation you can share with leadership or procurement as evidence of due diligence.

No coding required.

---

## How it works

1. **Choose or build a test suite** — pick a pre-built template, customize it in the Builder, or bring your own Google Sheet
2. **Run the evaluation** — Evergreen sends every test question to your AI and grades each response automatically, across safety, accuracy, ease of use, effectiveness, and tone
3. **Read the report** — a deployment recommendation with plain-language results showing what passed and what failed

---

## Quick Start

**Prerequisites:** Node.js 20+ and an API key for the AI you're testing (e.g. `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)

### Option A: Web app (recommended)

```bash
export ANTHROPIC_API_KEY=your-key-here
npx evergreen app
```

Open **http://localhost:4000**. From there you can browse the template library, build or customize test cases, and run an evaluation — all in the browser.

### Option B: CLI

```bash
export ANTHROPIC_API_KEY=your-key-here
```

Create `evergreen.yaml`:

```yaml
description: "My AI Chatbot Eval"
sheetId: "YOUR_GOOGLE_SHEET_ID"
providers:
  - id: anthropic:messages:claude-sonnet-4-20250514
    systemPrompt: |
      You are a helpful assistant.
```

Run and view:

```bash
npx evergreen run
npx evergreen serve
```

---

## Built-in test suites

Six ready-to-use suites, 25 test cases each:

- SNAP / Food Assistance
- Where's My Refund
- Benefits Eligibility Checker
- Agent Assist
- Call Center Summaries
- Permitting Assistant

---

## Architecture

```
Google Sheet  →  Evergreen          →  Promptfoo        →  LLM Under Test  →  Evergreen Report
(test cases)     CLI or Web App        (eval engine)       (OpenAI, etc.)     (4-tab HTML)
```

Evergreen wraps **[Promptfoo](https://github.com/promptfoo/promptfoo)** — an open-source eval runner — with a Google Sheets connector (no config files required for non-technical users), a web-based test suite builder, and a public-sector-specific HTML report with severity grading, a readiness badge, and four audience tabs: Summary, Analysis, Details, and Recommendations.

**Source layout:**

```
src/
├── index.ts          # CLI entry point (evergreen run / serve / app)
├── sheets.ts         # Fetch and parse Google Sheet
├── config.ts         # Generate Promptfoo config from sheet data
├── runner.ts         # Invoke Promptfoo, capture results
├── mapper.ts         # Map results to report format
├── builder.ts        # Builder ↔ SheetRow conversion, CSV export
├── types.ts          # Shared types
├── presets/          # 6 presets + blank + 2 demo suites
├── report/
│   └── generator.ts  # HTML report (4 tabs)
└── web/
    ├── server.ts     # Express web app
    ├── landing.html  # Home page
    ├── builder.html  # Test Suite Builder
    └── input.html    # Run form
```

---

## Principles

- **Domain-specific** — test cases are written by people who know the rules and the users; generic benchmarks don't capture jurisdictional context and give false confidence
- **Harm-aware** — failures are graded by real-world severity; an incorrect denial of benefits is not the same as a verbose answer
- **Accessible by design** — the primary interface is the web builder, not a config file; no coding required to create, run, or read an evaluation

---

## Documentation

| Guide | |
|-------|-|
| [What Is This?](./docs/01-what-is-this.md) | What Evergreen does and why it exists |
| [Quickstart](./docs/02-quickstart.md) | Step-by-step setup |
| [Writing Test Cases](./docs/03-writing-test-cases.md) | How to write effective evaluations |
| [Understanding Results](./docs/04-understanding-results.md) | How to read the report and make decisions |
| [Evaluation Design](./docs/05-evaluation-design.md) | The five metrics framework |
| [Technical Reference](./docs/06-technical-reference.md) | CLI, config options, and extending |
| [Roadmap: Human Evaluation](./docs/08-roadmap-human-evaluation.md) | Adding human review and public participation |

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).
