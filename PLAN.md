# Evergreen v2: Pre-Deployment AI Eval Pipeline for the Public Sector

## Project Plan

---

## 1. Problem Statement

Public sector agencies are deploying AI systems (chatbots, case assistants, benefits navigators) that directly affect people's lives. But a **technical capacity gap** exists between AI governance policy and its operationalization: agencies have frameworks and principles, but lack the practical, accessible tooling to translate those into day-to-day testing and assurance practices.

This gap — what Benjamin Goh (GovTech Singapore) calls the divide between policy intent and product execution — manifests as:

- **No uniform standard for AI testing**: Different testing providers offer conflicting recommendations on what to test. Agencies need a clear benchmark — a "bar" to cross — not a menu of options that varies by vendor.
- **Eval tooling requires engineering expertise** that most policy teams don't have, creating a bottleneck where governance depends on scarce technical staff.
- **Generic benchmarks miss domain context** — a model can score well on general tests but fail on jurisdiction-specific rules. Evaluations must be grounded in local realities, not translated from generic or Western-centric datasets.
- **No shared methodology** exists for the people closest to the problem — policy experts, program managers, *and members of the public / end users* — to participate in defining what a "correct" answer looks like and what constitutes real-world harm.
- **Integration across agencies is not straightforward** due to varying tech stacks and use cases. Whatever solution exists must be application- and model-agnostic.
- **Testing is treated as a one-time gate** rather than an ongoing practice. Agencies need not just pre-deployment testing, but also guardrails — mechanisms to continuously monitor and safeguard AI applications in production.

**This project provides a lean, open-source demo** that shows how policy experts, program managers, and members of the public can collaboratively create domain-specific evaluations, run them against any text-based LLM, and interpret the results — closing the gap between governance intent and operational practice.

---

## 2. Design Principles

Drawn from the referenced work (Propel evals, GovTech Singapore AI Guardian, Samiksha, UbuntuGuard):

### 2.1 Community-Informed, Expert-Defined, Automate-Second
What a "correct" answer looks like is informed by the people closest to the problem: **policy experts** who know the rules, **program managers** who know the operational context, and **members of the public / end users** who know how questions are actually asked and what answers actually help. The tool encodes their collective judgment; it does not replace it. (Propel: "You write down tests and find a system prompt that passes them." Samiksha: community members shape what gets evaluated, how benchmarks are constructed, and how outputs are scored.)

### 2.2 Co-Design Over Hand-Off
Policy SMEs, program managers, and community members are co-designers, not end-consumers of engineering output. The tool's primary interface is Google Sheets — a surface they already know — not a config file or CLI. (GovTech Singapore: co-design with non-technical officers; Samiksha: community-driven benchmark creation.)

### 2.3 Outcomes Over Process
The pipeline answers a concrete question: **"Is this AI system safe and accurate enough to deploy for [specific use case]?"** Every feature traces back to answering that question.

### 2.4 Context Is a First-Class Dimension
The same question can have different correct answers depending on jurisdiction, role, or scenario. Test cases encode this context explicitly. (Propel: state-by-state benefits variation; GovTech: agency-specific risk profiles; UbuntuGuard: culturally-grounded safety requires local context.)

### 2.5 Harm-Aware Prioritization
Not all errors are equal. The system helps users categorize failures by real-world impact (e.g., incorrectly denying an eligible applicant is worse than being slightly verbose). End users and community members are uniquely positioned to identify which failures cause real harm — their input should inform severity ratings, not just expert assumptions.

### 2.6 Application- and Model-Agnostic
The pipeline must work across different AI systems, LLM providers, and agency tech stacks. No vendor lock-in, no assumptions about infrastructure. (GovTech Singapore: Litmus is model-agnostic and multi-tenant; UK AISI Inspect: one interface over dozens of model providers.)

### 2.7 Lean and Open
Minimum viable surface area. No unnecessary abstractions, feature flags, or configurability. Apache 2.0 licensed. Everything needed to run the demo ships in this repo.

---

## 3. Target Users & Scenarios

```
┌──────────────────────────────────────────────────────────────┐
│  USER PERSONAS                                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  👤 Policy SME (Primary)                                     │
│     "I need to know if this chatbot gives correct answers    │
│      about our program before we launch it."                 │
│     - Writes test cases in Google Sheets                     │
│     - Reviews results in a visual report                     │
│     - No coding required                                     │
│                                                              │
│  👤 Program Manager / Procurement Officer                    │
│     "I need evidence that this vendor's AI meets our         │
│      standards before I sign off on deployment."             │
│     - Reads the summary report                               │
│     - Shares results with leadership                         │
│     - Uses pass/fail as a procurement gate                   │
│                                                              │
│  👤 Technical Implementer (Secondary)                        │
│     "I need to run these evals in CI/CD and tune our         │
│      system prompt to pass them."                            │
│     - Extends the eval config                                │
│     - Integrates into deployment pipeline                    │
│     - Debugs specific failures                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Demo Scenario
A state agency is considering deploying AI chatbots to answer public questions about **Colorado tax policy** and **unemployment insurance**. Before launch, the policy team uses Evergreen to:

1. **Define** test cases in a Google Sheet (questions + expected answers + context)
2. **Run** the eval against one or more LLMs
3. **Review** a clear report showing what passed, what failed, and why it matters
4. **Decide** whether the system is ready to deploy

---

## 4. Architecture

### 4.1 High-Level Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│             │     │              │     │              │     │              │
│  Google     │────▶│  Evergreen   │────▶│  LLM Under   │────▶│  Results     │
│  Sheet      │     │  Eval Runner │     │  Test (API)  │     │  Report      │
│  (test      │     │              │     │              │     │  (HTML/JSON) │
│   cases)    │     │  - fetch     │     │  - OpenAI    │     │              │
│             │     │  - parse     │     │  - Anthropic │     │  - pass/fail │
│             │     │  - run       │     │  - Local     │     │  - details   │
│             │     │  - grade     │     │              │     │  - summary   │
│             │     │              │     │              │     │              │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 4.2 Promptfoo as the Eval Engine

**Promptfoo is a direct dependency — we use it, not rebuild it.** Promptfoo is an open-source eval runner with a mature assertion engine, YAML config format, multi-provider support, and CLI. Rather than re-implementing any of this, Evergreen wraps Promptfoo with three layers:

```
┌──────────────────────────────────────────────────────────────────┐
│  What Evergreen adds on top of Promptfoo                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INPUT LAYER: Google Sheets → Promptfoo YAML                  │
│     Sheets connector fetches test cases and generates/updates    │
│     the Promptfoo config so SMEs never touch YAML                │
│                                                                  │
│  2. OUTPUT LAYER: Promptfoo JSON → Evergreen HTML Report         │
│     Custom report generator transforms Promptfoo's raw output    │
│     into a persona-tabbed report (Policy / Ops / Technical)      │
│                                                                  │
│  3. DOCS + EXAMPLES LAYER                                        │
│     Plain-language documentation and domain-specific examples    │
│     (CO Tax Policy, Unemployment Insurance) that non-technical   │
│     users can follow without understanding Promptfoo internals   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**What Promptfoo provides (we don't rebuild):**

| Promptfoo Capability | How Evergreen Uses It |
|---|---|
| Eval runner core | `npx promptfoo eval` executes test cases against providers |
| Assertion engine | `contains`, `not-contains`, `contains-all`, `regex`, `llm-rubric` — all built-in |
| YAML config format | Evergreen generates the YAML from Google Sheets data |
| Provider integrations | OpenAI, Anthropic, and others — configured in YAML |
| JSON output | Promptfoo's `--output` flag produces structured results that feed our report |

**What Promptfoo does NOT provide (Evergreen adds):**

| Gap | Evergreen Solution |
|---|---|
| No Google Sheets input | Sheets connector fetches, parses, and generates YAML |
| Generic HTML viewer | Custom HTML report with severity, readiness, critical failures |
| No persona-based views | Three tabs: Policy/Leadership, Operations, Technical |
| No methodology guidance | Docs + methodology guide for non-technical users |
| No domain examples | CO Tax Policy + Unemployment Insurance walkthroughs |

### 4.3 Technology Stack

- **Runtime**: Node.js (TypeScript)
- **Eval engine**: Promptfoo (npm dependency) — runs evals, grades responses
- **Config format**: YAML (Promptfoo-native)
- **Test case source**: Google Sheets (via Google Sheets API v4) → auto-generates YAML
- **LLM providers**: OpenAI, Anthropic (configured through Promptfoo)
- **Grading methods** (all Promptfoo built-ins):
  - String contains / exact match
  - Regex match
  - LLM-as-judge (model-graded)
  - Rubric-based (structured criteria)
- **Output**: Custom HTML report + JSON data + CLI summary
- **Documentation**: Markdown docs with diagrams (in `/docs`)

### 4.4 Project Structure

```
evergreen-v2/
├── README.md                    # Quick start (< 5 min setup)
├── LICENSE                      # Apache 2.0
├── package.json
├── tsconfig.json
│
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── config/
│   │   ├── loader.ts            # Load & validate YAML config
│   │   └── schema.ts            # Config type definitions
│   ├── sheets/
│   │   ├── connector.ts         # Google Sheets API integration
│   │   ├── parser.ts            # Parse sheet rows into test cases
│   │   └── auth.ts              # Google API authentication
│   ├── providers/
│   │   ├── base.ts              # Provider interface
│   │   ├── openai.ts            # OpenAI provider
│   │   └── anthropic.ts         # Anthropic provider
│   ├── eval/
│   │   ├── runner.ts            # Core eval execution loop
│   │   ├── graders.ts           # Assertion/grading functions
│   │   └── types.ts             # Eval types (TestCase, Result, etc.)
│   └── report/
│       ├── generator.ts         # Generate HTML/JSON reports
│       └── template.html        # Report HTML template
│
├── docs/
│   ├── 01-what-is-this.md       # Plain-language overview
│   ├── 02-quickstart.md         # Step-by-step setup guide
│   ├── 03-writing-test-cases.md # How to write evals in Sheets
│   ├── 04-understanding-results.md  # Reading the report
│   ├── 05-evaluation-design.md  # Methodology guide for SMEs
│   ├── 06-technical-reference.md    # Config options, CLI flags
│   └── images/                  # Screenshots, diagrams
│
├── examples/
│   ├── co-tax-policy/           # Colorado tax policy chatbot example
│   │   ├── evergreen.yaml       # Eval config
│   │   └── README.md            # Scenario walkthrough
│   └── unemployment-insurance/  # Unemployment insurance chatbot example
│       ├── evergreen.yaml
│       └── README.md
│
└── templates/
    └── google-sheet-template.md # Instructions to copy the template sheet
```

---

## 5. Google Sheets Integration (The Co-Design Surface)

The Google Sheet is the primary interface for non-technical users. It serves as both the test case authoring tool and the shared collaboration surface.

### 5.1 Sheet Structure

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  📊 Evergreen Eval: CO Tax Policy Chatbot — Test Cases                               │
├────┬───────────────┬──────────────┬──────────────┬──────────────┬───────────────────┤
│ #  │ Question      │ Expected     │ Context      │ Check Type   │ Severity          │
│    │ (prompt)      │ Answer       │ (optional)   │              │                   │
├────┼───────────────┼──────────────┼──────────────┼──────────────┼───────────────────┤
│ 1  │ What is the   │ 4.4%         │ CO state     │ contains     │ critical          │
│    │ Colorado      │              │ income tax,  │              │ (wrong rate =     │
│    │ state income  │              │ 2024 tax     │              │  real harm)       │
│    │ tax rate?     │              │ year         │              │                   │
├────┼───────────────┼──────────────┼──────────────┼──────────────┼───────────────────┤
│ 2  │ Do I owe CO   │ Depends on   │ Remote       │ llm-rubric   │ high              │
│    │ tax if I work │ whether you  │ worker,      │              │                   │
│    │ remotely for  │ are domiciled│ out-of-state │              │                   │
│    │ a CO company  │ in CO or     │ employer     │              │                   │
│    │ but live in   │ have CO-     │              │              │                   │
│    │ another state?│ source income│              │              │                   │
├────┼───────────────┼──────────────┼──────────────┼──────────────┼───────────────────┤
│ 3  │ How do I file │ Must mention:│ Practical    │ contains-all │ medium            │
│    │ my CO state   │ Revenue      │ navigation   │              │                   │
│    │ tax return?   │ Online,      │              │              │                   │
│    │               │ paper form,  │              │              │                   │
│    │               │ tax software │              │              │                   │
├────┼───────────────┼──────────────┼──────────────┼──────────────┼───────────────────┤
│ 4  │ Can I deduct  │ Must NOT say │ CO-specific  │ not-contains │ critical          │
│    │ my federal    │ "you cannot  │ SALT rules   │              │ (misinformation   │
│    │ taxes on my   │ deduct" as a │              │              │  = real harm)     │
│    │ CO return?    │ blanket      │              │              │                   │
│    │               │ statement    │              │              │                   │
└────┴───────────────┴──────────────┴──────────────┴──────────────┴───────────────────┘
```

### 5.2 Column Definitions (Plain Language)

| Column | What to put here | Example |
|---|---|---|
| **Question** | The question you'd ask the AI, exactly as a real user would phrase it | "What is the Colorado state income tax rate?" |
| **Expected Answer** | What a correct response should include (keyword, phrase, or description of a good answer) | "4.4%" or "Must mention Revenue Online and paper filing" |
| **Context** | Any situation-specific details that affect the correct answer | "2024 tax year" or "Remote worker, out-of-state" |
| **Check Type** | How to judge the response (pick from dropdown) | `contains`, `not-contains`, `llm-rubric`, `regex` |
| **Severity** | How bad is it if the AI gets this wrong? | `critical`, `high`, `medium`, `low` |

### 5.3 Supported Check Types

| Check Type | Plain English | When to Use |
|---|---|---|
| `contains` | Response must include this exact text | Specific numbers, names, URLs |
| `not-contains` | Response must NOT include this text | Dangerous misinformation |
| `contains-all` | Response must include ALL of these items (comma-separated) | Multiple required elements |
| `regex` | Response must match this pattern | Flexible text patterns |
| `llm-rubric` | An AI judge scores the response against your description of a good answer | Nuanced, subjective quality |

---

## 6. Eval Config (YAML)

The YAML config file connects the Google Sheet to the LLM providers. It is the only file the technical implementer needs to edit.

```yaml
# evergreen.yaml — Eval configuration
# This file is auto-generated by `npx evergreen sync` from the Google Sheet.
# You can also edit it directly if preferred.

description: "CO Tax Policy Chatbot — Pre-Deployment Eval"

# Where test cases come from
testCases:
  source: google-sheets
  sheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
  range: "TestCases!A2:F"  # Skip header row

# What to test — these are Promptfoo provider IDs
providers:
  - id: openai:gpt-4o
    config:
      systemPrompt: |
        You are a helpful assistant for Colorado state tax questions.
        Answer in plain language at a 6th grade reading level.
        Only provide information specific to Colorado tax law.

  - id: anthropic:claude-sonnet-4-20250514
    config:
      systemPrompt: |
        You are a helpful assistant for Colorado state tax questions.
        Answer in plain language at a 6th grade reading level.
        Only provide information specific to Colorado tax law.

# How to grade (defaults, can be overridden per test case in the Sheet)
defaultGrading:
  llmRubricProvider: openai:gpt-4o  # Model used as judge for llm-rubric checks

# Promptfoo output format — feeds into Evergreen's report generator
outputPath: ./results.json
```

---

## 7. Report Output

### 7.1 Summary View (What the Policy SME Sees)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  📋 EVAL REPORT: CO Tax Policy Chatbot                       │
│  Date: 2026-02-22 | Test Cases: 25 | Models: 2              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  OVERALL RESULTS                                             │
│  ┌────────────────────────┬────────────┬────────────┐        │
│  │ Model                  │ Pass Rate  │ Critical   │        │
│  │                        │            │ Failures   │        │
│  ├────────────────────────┼────────────┼────────────┤        │
│  │ GPT-4o                 │ 80% (20/25)│ 2          │        │
│  │ Claude Sonnet          │ 72% (18/25)│ 1          │        │
│  └────────────────────────┴────────────┴────────────┘        │
│                                                              │
│  RESULTS BY SEVERITY                                         │
│  ┌─────────────┬──────────┬──────────┐                       │
│  │ Severity    │ GPT-4o   │ Claude   │                       │
│  ├─────────────┼──────────┼──────────┤                       │
│  │ Critical    │ 6/8 ✓    │ 7/8 ✓    │                       │
│  │ High        │ 8/9 ✓    │ 6/9 ✓    │                       │
│  │ Medium      │ 4/5 ✓    │ 3/5 ✓    │                       │
│  │ Low         │ 2/3 ✓    │ 2/3 ✓    │                       │
│  └─────────────┴──────────┴──────────┘                       │
│                                                              │
│  ⚠️  CRITICAL FAILURES (require review before deployment)    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ #4: "Can I deduct federal taxes on my CO return?"    │    │
│  │     GPT-4o said "you cannot deduct" without nuance   │    │
│  │     ➜ Risk: Taxpayers may miss legitimate deductions  │    │
│  │                                                      │    │
│  │ #9: "When is my CO tax return due?"                  │    │
│  │     GPT-4o gave the federal date, not the CO date    │    │
│  │     ➜ Risk: Late filing, penalties for taxpayers      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  RECOMMENDATION                                              │
│  Based on critical failures, this system is NOT yet ready    │
│  for deployment. Address critical items and re-run evals.    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Detail View (Expandable per Test Case)

Each test case row expands to show:
- The exact question sent
- The model's full response
- The grading result and reason
- The severity level and potential real-world impact

---

## 8. Documentation Plan

Documentation is the primary deliverable. Every doc is written for a non-technical reader first.

### 8.1 Doc Structure

| Doc | Audience | Purpose | Length |
|---|---|---|---|
| `01-what-is-this.md` | Everyone | "What does this tool do and why should I care?" | 1 page |
| `02-quickstart.md` | Policy SME + Tech | Step-by-step from zero to first eval run | 2 pages |
| `03-writing-test-cases.md` | Policy SME | How to write good test cases in Google Sheets | 2 pages |
| `04-understanding-results.md` | Policy SME | How to read the report and make decisions | 1 page |
| `05-evaluation-design.md` | Policy SME | Methodology: the four-dimension framework | 2 pages |
| `06-technical-reference.md` | Tech implementer | Config options, CLI flags, extending | 2 pages |

### 8.2 Writing Standards

- **Reading level**: 8th grade or below (Hemingway Grade 8)
- **No jargon without definition**: Every technical term gets a plain-English explanation on first use
- **Visual aids in every doc**: At least one diagram, screenshot, or annotated example per document
- **Action-oriented**: Every section answers "what do I do next?"
- **Examples before abstractions**: Show the concrete case first, then generalize

### 8.3 Methodology Guide (Doc 05) — The Four-Dimension Framework

Adapted from Propel's SNAP eval work, generalized for any public sector domain:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  THE FOUR DIMENSIONS OF A GOOD AI EVAL                       │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │ 1. FACTUAL          │  │ 2. CONTEXTUAL       │           │
│  │    ACCURACY          │  │    UNDERSTANDING     │           │
│  │                     │  │                     │           │
│  │ Does the AI get     │  │ Does the AI handle  │           │
│  │ the facts right?    │  │ variations in       │           │
│  │                     │  │ jurisdiction, role,  │           │
│  │ Test: exact numbers,│  │ or scenario?        │           │
│  │ dates, rules        │  │                     │           │
│  │                     │  │ Test: same question, │           │
│  │ Check: contains,    │  │ different contexts   │           │
│  │ exact match         │  │                     │           │
│  └─────────────────────┘  └─────────────────────┘           │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │ 3. PRACTICAL        │  │ 4. COMMUNICATION    │           │
│  │    NAVIGATION       │  │    QUALITY          │           │
│  │                     │  │                     │           │
│  │ Does the AI help    │  │ Is the response     │           │
│  │ people take the     │  │ clear, readable,    │           │
│  │ right next step?    │  │ and appropriate?    │           │
│  │                     │  │                     │           │
│  │ Test: "how do I..?" │  │ Test: reading level,│           │
│  │ scenarios           │  │ tone, completeness  │           │
│  │                     │  │                     │           │
│  │ Check: contains-all,│  │ Check: llm-rubric   │           │
│  │ llm-rubric          │  │                     │           │
│  └─────────────────────┘  └─────────────────────┘           │
│                                                              │
│  START HERE ──▶ Dimension 1 (factual accuracy)               │
│  If it fails on facts, everything else is secondary.         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Plan

### Phase 1: Foundation (Sheets → Promptfoo Config)
*Informed by: Inspect's typed Dataset → Task pipeline; Singapore's model-agnostic design*

1. Initialize Node.js/TypeScript project; add `promptfoo` as npm dependency
2. Define Evergreen types (TestCase, SheetRow, ReportData) — the bridge between Google Sheets and Promptfoo's YAML format
3. Build Google Sheets connector (fetch rows via Sheets API, parse into typed test cases)
4. Build YAML generator: convert Sheet rows into Promptfoo-compatible `evergreen.yaml`
5. Support community-input columns in Sheet template (e.g., "Source: policy rule / user feedback / community input" to track where test cases originate)
6. Build CLI entry point: `npx evergreen sync` (Sheets → YAML) and `npx evergreen run` (sync + eval + report)

### Phase 2: Eval Execution (Promptfoo Wrapper)
*Promptfoo does the heavy lifting — Evergreen orchestrates and reports*

7. Wire `npx evergreen run` to invoke Promptfoo programmatically (via its Node API or CLI subprocess)
8. Configure provider setup (OpenAI, Anthropic) through the generated YAML
9. Validate that all Promptfoo assertion types work with Sheet-defined check types (`contains`, `not-contains`, `contains-all`, `regex`, `llm-rubric`)
10. Capture Promptfoo's JSON output for the report pipeline

### Phase 3: Reporting
*Informed by: Inspect's comprehensive logging; Singapore's governance-ready insights*

11. Build JSON → HTML report generator (summary + detail views, persona-tabbed) — **done** (generator.ts)
12. Wire Promptfoo's JSON output format into the report generator's expected input
13. Add severity-based aggregation and critical failure highlighting — **done** (built into generator)
14. Include provenance tracking: which test cases came from policy rules vs. user/community feedback

### Phase 4: Documentation & Examples
*Informed by: Samiksha's community-centered methodology; Propel's four-dimension framework*

15. Write all 6 documentation files with visual aids
16. Add methodology guide section on gathering community/user input for test cases
17. Create CO Tax Policy example (config + sheet template + walkthrough)
18. Create Unemployment Insurance example (config + sheet template + walkthrough)
19. Write README quick start with end-to-end instructions

### Phase 5: Polish
20. End-to-end test of full flow (Sheet → YAML → Promptfoo → JSON → Report)
21. Error messages in plain language (not stack traces)
22. Final review of all documentation for reading level and clarity

---

## 10. What Success Looks Like

A policy SME with no coding background can:

1. **Copy** the Google Sheet template (2 minutes)
2. **Fill in** 5-10 test cases about their domain — informed by user/community input on what questions real people ask and what answers actually help (30 minutes)
3. **Run** `npx evergreen run` with help from a technical colleague (5 minutes) — this syncs the Sheet, generates Promptfoo config, executes evals, and produces the report in one command
4. **Read** the HTML report and understand what passed and what failed (10 minutes)
5. **Make a decision** about whether the AI system is ready to deploy

The entire workflow produces a concrete artifact (the eval report) that can be shared with leadership, procurement, or oversight bodies as evidence of due diligence.

This closes the **technical capacity gap**: governance policy becomes operational practice, with community-informed test cases, automated execution (powered by Promptfoo), and actionable results — not just another framework document.

---

## 11. References & Inspirations

- **Propel SNAP LLM Evals** (Dave Guarino): Expert-first eval design, test-driven prompt development, four-dimension capability framework, Promptfoo + Google Sheets workflow
- **GovTech Singapore AI Guardian** (Benjamin Goh): Policy-Playbook-Product governance model, Litmus testing-as-a-service, Sentinel guardrails-as-a-service, co-design with non-technical officers, operationalized technical AI governance across ~1/3 of government agencies
- **Samiksha / Karya** (Microsoft Research, CIP, Karya — India): Community-driven evaluation pipeline, CSO and community member co-creation of benchmarks, culturally grounded evaluation across healthcare/agriculture/education/legal, multilingual and context-specific scoring
- **UK AISI Inspect** (AI Security Institute, UK): Open-source Python eval framework (Dataset → Task → Solver → Scorer), adopted by Anthropic/DeepMind/major labs, 100+ pre-built evals, composition-first design, reproducible logging, sandboxed execution
- **UbuntuGuard** (Abdullahi et al., 2025): First African-language policy-based safety benchmark; 155 domain experts authoring adversarial queries; evidence that English-centric benchmarks overestimate multilingual safety; static/dynamic/multilingual test variants
- **Colorado Digital Equity SNAP Evals** (CDLE): State-level benefits chatbot evaluation, jurisdiction-specific test cases, harm-aware severity grading
- **Promptfoo** (open source): Eval runner architecture, assertion types, YAML config format, provider abstraction
- **NIST AI RMF**: Risk-based approach to AI evaluation aligned with federal standards

See [RESEARCH.md](./RESEARCH.md) for detailed citations, methodology notes, and where each reference informs our approach.
