# Evergreen v2

**Pre-deployment AI evaluation for the public sector — built for the people closest to the problem.**

---

## The Problem

Public sector agencies are deploying AI systems — chatbots, case assistants, benefits navigators — that directly affect people's lives. But a **technical capacity gap** exists between AI governance policy and operational practice.

Agencies have frameworks and principles. What they lack is practical, accessible tooling to translate those into day-to-day testing and assurance. The result:

- **No uniform standard** for what to test — vendors offer conflicting recommendations, and there's no clear "bar" to cross
- **Eval tooling requires engineering expertise** that policy teams don't have, bottlenecking governance on scarce technical staff
- **Generic benchmarks miss domain context** — a model can score well on general tests but fail on jurisdiction-specific rules (UbuntuGuard showed English-centric benchmarks actively overestimate safety for non-English populations)
- **No shared methodology** for policy experts, program managers, *and members of the public* to participate in defining what "correct" looks like
- **Testing is treated as a one-time gate** instead of an ongoing practice

This gap has been independently identified across multiple governments: GovTech Singapore (AI Guardian), the UK AI Security Institute (Inspect), India's Samiksha/Karya initiative, and Colorado's benefits chatbot evaluations all converge on the same core challenge.

## The Solution

Evergreen is a lean, open-source evaluation pipeline that lets **non-technical domain experts** create, run, and interpret AI evaluations — without writing code.

The key insight: **what a "correct" answer looks like should be defined by the people closest to the problem** — policy experts who know the rules, program managers who know the operational context, and members of the public who know how questions are actually asked and what answers actually help.

**How it works:**

1. **Define** test cases in a Google Sheet — questions, expected answers, context, severity (informed by expert knowledge *and* community/user input)
2. **Run** `npx evergreen run` — the pipeline sends each question to the AI system under test, collects responses, and grades them
3. **Review** a clear HTML report showing what passed, what failed, and why it matters
4. **Decide** whether the system is ready to deploy — with a concrete artifact to share with leadership, procurement, or oversight bodies

**Design principles:**
- **Community-informed, expert-defined** — end users inform prompts and expected outcomes alongside policy experts
- **Co-design over hand-off** — Google Sheets as the primary interface, not config files or CLIs
- **Context is a first-class dimension** — jurisdiction, role, and scenario are encoded in every test case
- **Harm-aware prioritization** — not all errors are equal; severity reflects real-world impact
- **Application- and model-agnostic** — works across LLM providers and agency tech stacks
- **Lean and open** — Apache 2.0, minimum viable surface area

## Architecture

```
Google Sheet  →  Evergreen CLI     →  Promptfoo        →  LLM Under Test  →  Evergreen Report
(test cases)     (sync + orchestrate)  (eval engine)       (OpenAI, etc.)     (HTML + JSON)
```

**[Promptfoo](https://github.com/promptfoo/promptfoo)** is the eval engine — it runs prompts against models, grades responses, and outputs structured results. Evergreen wraps it with a Google Sheets input layer, a custom report generator, and plain-language documentation so non-technical users never need to touch Promptfoo directly.

Inspired by [UK AISI Inspect](https://inspect.aisi.org.uk/)'s composable pipeline, [GovTech Singapore Litmus](https://medium.com/aiguardian-govtech/how-we-built-the-ai-guardian-team-at-govtech-singapore-3758cf21004d)'s model-agnostic design, and Promptfoo's assertion engine — adapted for accessibility via Google Sheets.

## Current Status

This project is in active development. See:
- [PLAN.md](./PLAN.md) — Full project plan with architecture, implementation phases, and methodology
- [RESEARCH.md](./RESEARCH.md) — Market/user research citations showing where similar approaches have succeeded (Singapore, India, UK, Colorado)

## Research & Prior Art

| Organization | What They Built | What We Learned |
|---|---|---|
| [GovTech Singapore](https://medium.com/aiguardian-govtech/how-we-built-the-ai-guardian-team-at-govtech-singapore-3758cf21004d) | Litmus (testing) + Sentinel (guardrails) | Policy-Playbook-Product model; ~1/3 of agencies adopted |
| [Samiksha / Karya](https://evals.karya.in/samiksha/) | Community-driven eval pipeline | End users must co-define "correct"; community-informed evals catch more failures |
| [UK AISI Inspect](https://inspect.aisi.org.uk/) | Open-source eval framework | Dataset → Task → Solver → Scorer composability; adopted by major labs |
| [UbuntuGuard](https://arxiv.org/abs/2601.12696) | African-language safety benchmarks | Generic benchmarks overestimate safety; cultural context is not optional |
| [CDLE / Propel](./RESEARCH.md#4-colorado-department-of-labor-and-employment-cdle--benefits-chatbot-evals) | State-level benefits chatbot evals | Jurisdiction-specific test cases; eval reports as procurement gates |

## License

Apache 2.0 — see [LICENSE](./LICENSE).
