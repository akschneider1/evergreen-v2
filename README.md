# Evergreen v2

**Pre-deployment AI evaluation for the public sector — built for the people closest to the problem.**

---

## Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+
- An API key for the LLM you're testing (e.g., `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

### 1. Create a Google Sheet with test cases

Set up a Google Sheet with these 5 columns. **Row 1 = header, row 2 = example/instructions (leave as-is), data starts row 3:**

| Question | Expected Answer | Context | Check Type | Severity |
|----------|----------------|---------|------------|----------|
| What is the CO state income tax rate? | 4.4% | | contains | critical |
| How do I file my CO tax return? | Revenue Online, paper form, tax software | | contains-all | medium |
| Can I deduct federal taxes on my CO return? | you cannot deduct | CO SALT rules | not-contains | critical |

Share the sheet as **"Anyone with the link can view."**

---

### Option A: Web App (no config file needed)

#### 2. Set your API key

```bash
export OPENAI_API_KEY=sk-your-key-here
```

#### 3. Launch the web app

```bash
npx evergreen app
```

Open **http://localhost:4000**. Fill in the form:

- **Evaluation name** — a label for this run (e.g., "CO Tax Chatbot — March 2026")
- **Google Sheet URL** — paste the full link from your browser
- **LLM provider** — select from the dropdown (Claude Sonnet, GPT-4o, etc.)
- **System prompt** — the instructions your AI uses (optional)

Click **Run Evaluation**. A step-by-step progress indicator tracks the pipeline. When complete, click the link to open the report.

---

### Option B: CLI (for scripting and CI/CD)

#### 2. Create `evergreen.yaml`

```yaml
description: "My AI Chatbot Eval"
sheetId: "YOUR_GOOGLE_SHEET_ID"
providers:
  - id: openai:gpt-4o
    systemPrompt: |
      You are a helpful assistant.
```

Replace `YOUR_GOOGLE_SHEET_ID` with the ID from your Sheet URL (the string between `/d/` and `/edit`).

#### 3. Run

```bash
export OPENAI_API_KEY=sk-your-key-here
npx evergreen run
```

#### 4. View the report

```bash
npx evergreen serve
```

Open **http://localhost:4000** in your browser. The report shows pass/fail for every test case, highlights critical failures, and gives a deployment recommendation across three tabs — Summary (leadership), Analysis (operations), and Details (technical).

---

## The Problem

Public sector agencies are deploying AI systems — chatbots, case assistants, benefits navigators — that directly affect people's lives. But a **technical capacity gap** exists between AI governance policy and operational practice.

Agencies have frameworks and principles. What they lack is practical, accessible tooling to translate those into day-to-day testing and assurance. The result:

- **No uniform standard** for what to test — vendors offer conflicting recommendations, and there's no clear "bar" to cross
- **Eval tooling requires engineering expertise** that policy teams don't have, bottlenecking governance on scarce technical staff
- **Generic benchmarks miss domain context** — a model can score well on general tests but fail on jurisdiction-specific rules
- **No shared methodology** for policy experts, program managers, *and members of the public* to participate in defining what "correct" looks like

## The Solution

Evergreen is a lean, open-source evaluation pipeline that lets **non-technical domain experts** create, run, and interpret AI evaluations — without writing code.

The key insight: **what a "correct" answer looks like should be defined by the people closest to the problem** — policy experts who know the rules, program managers who know the operational context, and members of the public who know how questions are actually asked and what answers actually help.

### The 45-Minute Workflow

| Step | Who | Time |
|------|-----|------|
| **Copy** the Google Sheet template | Policy SME | 2 min |
| **Write** 5-10 test cases — informed by community input on what people actually ask | Policy SME | 30 min |
| **Run** `npx evergreen run` | Technical colleague | 5 min |
| **Read** the HTML report | Policy SME | 10 min |
| **Decide** whether the system is ready to deploy | Decision-maker | — |

The report is a concrete artifact that can be shared with leadership, procurement, or oversight bodies as evidence of due diligence.

---

## Architecture

```
Google Sheet  →  Evergreen          →  Promptfoo        →  LLM Under Test  →  Evergreen Report
(test cases)     CLI or Web App        (eval engine)       (OpenAI, etc.)     (3-tab HTML)
```

**[Promptfoo](https://github.com/promptfoo/promptfoo)** is the eval engine — it runs prompts against models, grades responses, and outputs structured results. Evergreen wraps it with:

1. **Input layer** — Google Sheets → Promptfoo YAML (so SMEs never touch config files); web app accepts full Sheet URL directly
2. **Output layer** — Promptfoo JSON → HTML report with severity, readiness, and critical failures
3. **Two modes** — `evergreen run` (CLI, requires `evergreen.yaml`) and `evergreen app` (browser form, no config file)
4. **Documentation** — plain-language guides for non-technical users

### What's in the Box

```
src/
├── index.ts          # CLI: evergreen run / serve / app
├── sheets.ts         # Fetch Google Sheet → parse rows (skips row 2 example row)
├── config.ts         # Generate Promptfoo YAML from sheet data
├── runner.ts         # Invoke Promptfoo, capture JSON (sync + async)
├── mapper.ts         # Promptfoo JSON → report input
├── types.ts          # Shared types + promptfoo output normalizer
├── report/
│   └── generator.ts  # Render HTML report (3 tabs: Summary, Analysis, Details)
└── web/
    ├── server.ts     # Express app: form → pipeline → report (evergreen app)
    └── input.html    # USWDS input form (Sheet URL, provider, system prompt)
```

---

## Documentation

| Guide | For | |
|-------|-----|-|
| [What Is This?](./docs/01-what-is-this.md) | Everyone | What Evergreen does and why it exists |
| [Quickstart](./docs/02-quickstart.md) | Policy SME + Tech | Step-by-step setup |
| [Writing Test Cases](./docs/03-writing-test-cases.md) | Policy SME | How to write effective evaluations |
| [Understanding Results](./docs/04-understanding-results.md) | Policy SME | How to read the report and make decisions |
| [Evaluation Design](./docs/05-evaluation-design.md) | Policy SME | The four-dimension framework |
| [Technical Reference](./docs/06-technical-reference.md) | Technical implementer | Config options, CLI flags, extending |

---

## Examples

- [Colorado Tax Policy Chatbot](./examples/co-tax-policy/) — evaluating a state tax chatbot with 10 test cases across all four dimensions

---

## Design Principles

- **Community-informed, expert-defined** — end users inform what gets tested alongside policy experts
- **Co-design over hand-off** — Google Sheets as the primary interface, not config files
- **Context is a first-class dimension** — jurisdiction, role, and scenario are encoded in every test case
- **Harm-aware prioritization** — not all errors are equal; severity reflects real-world impact
- **Application- and model-agnostic** — works across LLM providers and agency tech stacks
- **Lean and open** — Apache 2.0, minimum viable surface area

---

## Research & Prior Art

| Organization | What They Built | What We Learned |
|---|---|---|
| [GovTech Singapore](https://medium.com/aiguardian-govtech/how-we-built-the-ai-guardian-team-at-govtech-singapore-3758cf21004d) | Litmus (testing) + Sentinel (guardrails) | Policy-Playbook-Product model; ~1/3 of agencies adopted |
| [Samiksha / Karya](https://evals.karya.in/samiksha/) | Community-driven eval pipeline | End users must co-define "correct"; community-informed evals catch more failures |
| [UK AISI Inspect](https://inspect.aisi.org.uk/) | Open-source eval framework | Dataset → Task → Solver → Scorer composability; adopted by major labs |
| [UbuntuGuard](https://arxiv.org/abs/2601.12696) | African-language safety benchmarks | Generic benchmarks overestimate safety; cultural context is not optional |
| [CDLE / Propel](./RESEARCH.md#4-colorado-department-of-labor-and-employment-cdle--benefits-chatbot-evals) | State-level benefits chatbot evals | Jurisdiction-specific test cases; eval reports as procurement gates |

See [RESEARCH.md](./RESEARCH.md) for detailed citations and methodology notes.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).
