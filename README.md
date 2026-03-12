# Evergreen

**Pre-deployment AI evaluation for government — by the people closest to the problem.**

---

You're deploying an AI tool — a chatbot, a benefits navigator, a case assistant — and you need to know it gives the right answers before real people use it. Evergreen lets you check. You write the questions and define what a good answer looks like. Evergreen tests whether your AI delivers it, grades every response automatically, and produces a plain-language report with a deployment recommendation you can share with leadership or oversight as evidence of due diligence.

**No coding required to create test cases or read results.**

---

## Who Is This For?

| Role | What you do in Evergreen |
|------|--------------------------|
| **Policy expert / program manager** | Write test cases in the browser — you know the rules, you define what correct looks like |
| **Technical lead** | Set up the API keys and run the evaluation (5 minutes); everything else is in the browser |
| **Leadership / procurement** | Receive the report — a compliance artifact with a deployment verdict and evidence |

---

## How It Works

1. **Choose or build a test suite** — pick one of six pre-built templates, customize it in the browser-based Builder, or bring your own Google Sheet
2. **Run the evaluation** — Evergreen sends every test question to your AI and grades each response automatically across five dimensions: Safety, Accuracy, Ease of Use, Effectiveness, and Emotion
3. **Read the report** — a three-tab HTML report with a deployment recommendation, critical failure callouts, and prioritized next steps

---

## Quick Start

**Prerequisites:** Node.js 20+ and an API key for the AI you're testing

```bash
# Set your API key (OpenAI or Anthropic)
export ANTHROPIC_API_KEY=your-key-here

# Launch the web app
npx evergreen app
```

Open **http://localhost:4000**. From there, pick a template, review and edit test cases in the Builder, and run your evaluation — all in the browser.

For a full step-by-step walkthrough, see the [Quickstart Guide](./docs/02-quickstart.md).

---

## Features

### Test Suite Builder
A browser-based editor for creating and editing test cases — no spreadsheet or config file required. Each test case has:
- **Question** — what a real user might ask the AI
- **What to check** — what the correct response should include (or avoid)
- **Metric** — which of the five quality dimensions this tests
- **Severity** — how bad it is if this test fails (critical, high, medium, or low)

When you're done, click **Run Evaluation →** to go straight to the run form. You can also export your test cases as a CSV to save or share.

### Six Ready-to-Use Test Suites
Pre-built suites of 25 test cases each, covering real public-sector use cases:

| Suite | Domain | What It Tests |
|-------|--------|---------------|
| **SNAP / Food Assistance** | Benefits | Eligibility questions, application guidance, safety around incorrect denials |
| **Where's My Refund** | Revenue | Tax refund status, identity verification, accuracy of refund timelines |
| **Benefits Eligibility Checker** | Benefits | Multi-program eligibility, plain-language explanations, edge cases |
| **Agent Assist** | Call center | Staff-facing AI — accuracy, escalation guidance, tone with callers in distress |
| **Call Center Summaries** | Call center | AI-generated call summaries — accuracy, completeness, appropriate brevity |
| **Permitting Assistant** | Permitting | Multi-turn conversations with three user personas (homeowner, contractor, renter) |

> **Persona testing (Permitting Assistant):** Some evaluations test how the AI responds to the same question from different types of users. The Permitting Assistant suite runs each test as a homeowner, a contractor, and a renter — each with different context — because the right answer may vary depending on who is asking.

### Five Grading Dimensions
Every test case is assigned exactly one metric. Evergreen uses that metric to determine what to check and how strictly:

| Metric | What It Checks |
|--------|----------------|
| **Safety** | Does the response avoid harmful, misleading, or legally risky content? |
| **Accuracy** | Does the response include the correct factual information? |
| **Ease of Use** | Can a non-expert understand and act on this response? |
| **Effectiveness** | Does the response actually help the person accomplish their goal? |
| **Emotion** | Does the response treat the person with respect and empathy? |

Safety and Accuracy failures on critical-severity tests block deployment regardless of overall pass rate.

### Severity Grading
Each test case carries a severity level — **critical**, **high**, **medium**, or **low** — that reflects the real-world impact of a wrong answer. An incorrect denial of benefits is not the same as a verbose response. Severity is set by the person writing the test cases, not by the tool.

### Three-Tab Report
Every evaluation produces a self-contained HTML report you can share, save, or attach to a procurement record:

- **Report tab** — overall pass rate, readiness verdict (Ready / Needs Improvement / Not Ready), critical failure callouts, pass rates by metric and by severity, and a filterable table of every test case with the AI's exact response and grading reason
- **Performance tab** *(optional — requires Langfuse)* — per-test latency, token counts, and estimated cost; pass rate trend over time; results by user persona
- **Recommendations tab** — prioritized next steps organized by who acts on them: **Prompt** (AI team, same day), **Data** (subject matter experts, no AI expertise needed), **Model** (leadership decision), and **Process** (habits that prevent future regressions)

### Google Sheets Integration
Prefer a spreadsheet? Write test cases in a Google Sheet (5 columns: `Question` | `What to Check` | `Context` | `Metric` | `Severity`), share it as view-only, and paste the URL into the run form. Evergreen fetches and runs it automatically.

### Optional Observability with Langfuse
Set `LANGFUSE_SECRET_KEY` and `LANGFUSE_PUBLIC_KEY` to enable tracing. When active:
- Every evaluation run is traced end-to-end in Langfuse
- The Performance tab in the report shows real latency, token counts, and cost per test
- Reviewers can submit thumbs up/down feedback on individual test cases from inside the report
- Automatic scores (pass/fail, metric, severity) are attached to each trace

```bash
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_PUBLIC_KEY=pk-lf-...
npx evergreen app
```

---

## Built-in Test Suites

All six suites are available from the landing page. Click **"Open in Builder"** to customize any of them before running, or **"Run now"** to use them as-is.

Two additional **demo suites** (5 tests each) are included for training and onboarding — one that reliably produces a "Ready" verdict and one that produces a "Not Ready" verdict, so new evaluators can see what both outcomes look like before running a real evaluation.

---

## Architecture

```
Google Sheet  →  Evergreen          →  Promptfoo        →  LLM Under Test      →  Evergreen Report
(test cases)     CLI or Web App        (eval engine)       (OpenAI, Anthropic)     (3-tab HTML)
```

Evergreen wraps **[Promptfoo](https://github.com/promptfoo/promptfoo)** — an open-source eval runner — with a Google Sheets connector, a browser-based test suite builder, and a public-sector-specific report format with severity grading, readiness verdicts, and layered recommendations.

The same four-step pipeline (fetch → configure → evaluate → report) runs in both the web app and the CLI.

<details>
<summary>Source layout (for developers)</summary>

```
src/
├── index.ts          # CLI entry point (evergreen run / serve / app)
├── sheets.ts         # Fetch and parse Google Sheet
├── config.ts         # Generate Promptfoo config from sheet data
├── runner.ts         # Invoke Promptfoo, capture results
├── mapper.ts         # Map results to report format
├── builder.ts        # Builder ↔ SheetRow conversion, CSV export
├── types.ts          # Shared types
├── langfuse.ts       # Optional Langfuse observability helpers
├── presets/          # 6 full presets + blank + 2 demo suites
├── report/
│   └── generator.ts  # HTML report (3 tabs: Report, Performance, Recommendations)
└── web/
    ├── server.ts     # Express web app
    ├── landing.html  # Home page
    ├── builder.html  # Test Suite Builder
    └── input.html    # Run form
```

</details>

---

## Documentation

| Guide | |
|-------|-|
| [What Is This?](./docs/01-what-is-this.md) | What Evergreen does and why it exists |
| [Quickstart](./docs/02-quickstart.md) | Step-by-step setup for both the web app and CLI |
| [Writing Test Cases](./docs/03-writing-test-cases.md) | How to write effective evaluations |
| [Understanding Results](./docs/04-understanding-results.md) | How to read the report and make decisions |
| [Evaluation Design](./docs/05-evaluation-design.md) | The five metrics framework |
| [Technical Reference](./docs/06-technical-reference.md) | CLI flags, config options, and extending |
| [Participatory Design](./docs/07-participatory-design.md) | How the tool was designed with users |
| [Roadmap: Human Evaluation](./docs/08-roadmap-human-evaluation.md) | What comes next |

For market research and design principles, see [RESEARCH.md](./RESEARCH.md).

---

## Principles

- **Domain-specific** — test cases are written by people who know the rules and the users; generic benchmarks don't capture jurisdictional context and give false confidence
- **Harm-aware** — failures are graded by real-world severity; an incorrect denial of benefits is not the same as a verbose answer
- **Accessible by design** — the primary interface is the browser, not a config file; no coding required to create, run, or read an evaluation

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).
