# Evergreen

**Pre-deployment AI evaluation for the public sector — built for the people closest to the problem.**

---

## The Problem

Public sector agencies are deploying AI systems — chatbots, case assistants, benefits navigators — that directly affect people's lives. But a **technical capacity gap** exists between AI governance policy and operational practice.

Agencies have frameworks and principles. What they lack is practical, accessible tooling to translate those into day-to-day testing and assurance. The result:

- **No uniform standard for AI testing** — vendors offer conflicting recommendations, and there's no clear "bar" to cross
- **Eval tooling requires engineering expertise** that policy teams don't have, bottlenecking governance on scarce technical staff
- **Generic benchmarks miss domain context** — a model can score well on general tests but fail on jurisdiction-specific rules (a Colorado tax chatbot needs Colorado-specific evals, not generic ones)
- **No shared methodology** for policy experts, program managers, *and members of the public* to participate in defining what "correct" looks like and what constitutes real-world harm

This gap — what Benjamin Goh (GovTech Singapore) calls the divide between policy intent and product execution — means that governance exists on paper but can't be operationalized in practice.

## The Solution

Evergreen is a lean, open-source evaluation pipeline that lets **non-technical domain experts** create, run, and interpret AI evaluations — without writing code.

The key insight: **what a "correct" answer looks like should be defined by the people closest to the problem** — policy experts who know the rules, program managers who know the operational context, and members of the public who know how questions are actually asked and what answers actually help.

### Who It's For

| Persona | What they do | What they need |
|---------|-------------|----------------|
| **Policy SME** (primary) | Writes test cases in Google Sheets, reviews results | No coding required; clear pass/fail with severity context |
| **Program Manager / Procurement Officer** | Reads the summary report, shares with leadership | Evidence that a vendor's AI meets standards before sign-off |
| **Technical Implementer** (secondary) | Runs evals in CI/CD, tunes system prompts | CLI integration, detailed failure debugging |

### The 45-Minute Workflow

| Step | Who | Time |
|------|-----|------|
| **Copy** the Google Sheet template | Policy SME | 2 min |
| **Write** 5–10 test cases — informed by community input on what people actually ask | Policy SME | 30 min |
| **Run** `npx evergreen app` or `npx evergreen run` | Technical colleague | 5 min |
| **Read** the HTML report | Policy SME | 10 min |
| **Decide** whether the system is ready to deploy | Decision-maker | — |

The report is a concrete artifact that can be shared with leadership, procurement, or oversight bodies as evidence of due diligence.

---

## Quick Start

### Prerequisites

- Node.js 20+
- An API key for the LLM you're testing (e.g., `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

### 1. Create a Google Sheet with test cases

Set up a Google Sheet with these 5 columns. **Row 1 = header, row 2 = example/instructions (leave as-is), data starts row 3:**

| Question | What to Check | Context | Metric | Severity |
|----------|---------------|---------|--------|----------|
| What is the CO state income tax rate? | 4.4% | | Accuracy | critical |
| How do I file my CO tax return? | Revenue Online, paper form, tax software | | Accuracy | medium |
| Can I deduct federal taxes on my CO return? | response claims federal taxes are deductible | CO SALT rules | Safety | critical |

You choose a **Metric** (Safety, Accuracy, Ease of Use, Effectiveness, or Emotion) — Evergreen infers the grading logic automatically.

Share the sheet as **"Anyone with the link can view."**

> **Don't have test cases yet?** The web app includes five built-in test suites (25 tests each) that you can run immediately — no Google Sheet required. See Option A below.

### Option A: Web App (no config file needed)

```bash
export OPENAI_API_KEY=sk-your-key-here
npx evergreen app
```

Open **http://localhost:4000**. Fill in the form (Sheet URL, provider, system prompt) and click **Run Evaluation**. A step-by-step progress indicator tracks the pipeline. When complete, click the link to open the report.

### Option B: CLI (for scripting and CI/CD)

```bash
export OPENAI_API_KEY=sk-your-key-here
```

Create `evergreen.yaml`:

```yaml
description: "My AI Chatbot Eval"
sheetId: "YOUR_GOOGLE_SHEET_ID"
providers:
  - id: openai:gpt-4o
    systemPrompt: |
      You are a helpful assistant.
```

Run the evaluation and view the report:

```bash
npx evergreen run
npx evergreen serve
```

The report shows pass/fail for every test case, highlights critical failures, and gives a deployment recommendation across three tabs — Summary (leadership), Analysis (operations), and Details (technical).

---

## Architecture

```
Google Sheet  →  Evergreen          →  Promptfoo        →  LLM Under Test  →  Evergreen Report
(test cases)     CLI or Web App        (eval engine)       (OpenAI, etc.)     (3-tab HTML)
```

### Promptfoo as the Eval Engine

**[Promptfoo](https://github.com/promptfoo/promptfoo)** is a direct dependency — we use it, not rebuild it. Promptfoo is an open-source eval runner with a mature assertion engine, YAML config format, and multi-provider support. Evergreen wraps it with three layers:

**What Promptfoo provides (we don't rebuild):**

| Capability | How Evergreen Uses It |
|---|---|
| Eval runner core | `npx promptfoo eval` executes test cases against providers |
| Assertion engine | Text matching, pattern matching, and LLM-as-judge grading — mapped automatically from the 5 lead metrics |
| YAML config format | Evergreen generates the YAML from Google Sheets data |
| Provider integrations | OpenAI, Anthropic, and others — configured in YAML |
| JSON output | Structured results that feed Evergreen's report generator |

**What Promptfoo does NOT provide (Evergreen adds):**

| Gap | Evergreen Solution |
|---|---|
| No Google Sheets input | Sheets connector fetches, parses, and generates YAML — SMEs never touch config files |
| Generic HTML viewer | Custom HTML report with severity, readiness badge, and critical failure highlighting |
| No persona-based views | Three tabs: Summary (Policy/Leadership), Analysis (Operations), Details (Technical) |
| No methodology guidance | Documentation and methodology guides written for non-technical users |
| No domain examples | Colorado Tax Policy walkthrough with 10 sample test cases |

### What's in the Box

```
src/
├── index.ts          # CLI: evergreen run / serve / app
├── sheets.ts         # Fetch Google Sheet → parse rows
├── config.ts         # Generate Promptfoo YAML from sheet data
├── runner.ts         # Invoke Promptfoo, capture JSON (sync + async)
├── mapper.ts         # Promptfoo JSON → report input
├── types.ts          # Shared types + Promptfoo output normalizer
├── report/
│   └── generator.ts  # Render HTML report (3 tabs: Summary, Analysis, Details)
└── web/
    ├── server.ts     # Express app: form → pipeline → report
    └── input.html    # USWDS input form
```

---

## Design Principles

These principles are drawn from prior art by GovTech Singapore, Samiksha/Karya, Propel, UK AISI, and UbuntuGuard. See [RESEARCH.md](./RESEARCH.md) for detailed citations.

### Community-Informed, Expert-Defined

What a "correct" answer looks like is informed by the people closest to the problem: **policy experts** who know the rules, **program managers** who know the operational context, and **members of the public** who know how questions are actually asked and what answers actually help. The tool encodes their collective judgment; it does not replace it.

### Co-Design Over Hand-Off

Policy SMEs and community members are co-designers, not end-consumers of engineering output. The tool's primary interface is Google Sheets — a surface they already know — not a config file or CLI.

### Context Is a First-Class Dimension

The same question can have different correct answers depending on jurisdiction, role, or scenario. Test cases encode this context explicitly. Generic benchmarks are actively misleading — they don't just miss context, they give false confidence.

### Harm-Aware Prioritization

Not all errors are equal. The system helps users categorize failures by real-world impact (e.g., incorrectly denying an eligible applicant is worse than being slightly verbose). Severity reflects consequences, not just frequency.

### Application- and Model-Agnostic

The pipeline works across different AI systems, LLM providers, and agency tech stacks. No vendor lock-in, no assumptions about infrastructure.

### Lean and Open

Minimum viable surface area. No unnecessary abstractions, feature flags, or configurability. Apache 2.0 licensed. Everything needed to run ships in this repo.

---

## Documentation

| Guide | For | |
|-------|-----|-|
| [What Is This?](./docs/01-what-is-this.md) | Everyone | What Evergreen does and why it exists |
| [Quickstart](./docs/02-quickstart.md) | Policy SME + Tech | Step-by-step setup |
| [Writing Test Cases](./docs/03-writing-test-cases.md) | Policy SME | How to write effective evaluations |
| [Understanding Results](./docs/04-understanding-results.md) | Policy SME | How to read the report and make decisions |
| [Evaluation Design](./docs/05-evaluation-design.md) | Policy SME | The five lead metrics framework |
| [Technical Reference](./docs/06-technical-reference.md) | Technical implementer | Config options, CLI flags, extending |

---

## Examples

- [Colorado Tax Policy Chatbot](./examples/co-tax-policy/) — evaluating a state tax chatbot with 10 test cases across all five lead metrics

---

## Research & Prior Art

Evergreen's design is informed by real-world implementations across five countries. Each shaped specific decisions in the tool.

| Organization | What They Built | What We Learned |
|---|---|---|
| [GovTech Singapore](https://medium.com/aiguardian-govtech/how-we-built-the-ai-guardian-team-at-govtech-singapore-3758cf21004d) | Litmus (testing) + Sentinel (guardrails) | The "technical capacity gap" is the core problem; co-design with non-technical officers works at scale (~1/3 of agencies adopted) |
| [Samiksha / Karya](https://evals.karya.in/samiksha/) | Community-driven eval pipeline | End users must co-define "correct"; community-informed evals catch failures that expert-only approaches miss |
| [UK AISI Inspect](https://inspect.aisi.org.uk/) | Open-source eval framework | Dataset → Task → Solver → Scorer composability; model-agnostic is non-negotiable; adopted by major labs |
| [UbuntuGuard](https://arxiv.org/abs/2601.12696) | African-language safety benchmarks | Generic benchmarks overestimate safety; cultural and jurisdictional context is not optional |
| [CDLE / Propel](./RESEARCH.md#4-colorado-department-of-labor-and-employment-cdle--benefits-chatbot-evals) | State-level benefits chatbot evals | Jurisdiction-specific test cases; four-dimension eval framework; eval reports as procurement gates |

See [RESEARCH.md](./RESEARCH.md) for detailed citations, methodology notes, and where each reference informs our approach.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).
