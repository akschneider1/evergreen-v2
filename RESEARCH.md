# Market & User Research

This document catalogs the research, prior art, and real-world examples that inform Evergreen v2's design. Each entry describes *what* the organization built, *what we learned* from it, and *how it shapes our approach*.

---

## 1. GovTech Singapore — AI Guardian (Litmus & Sentinel)

**Source**: Benjamin Goh, "How we built the AI Guardian team at GovTech Singapore"
- [Medium blog post](https://medium.com/aiguardian-govtech/how-we-built-the-ai-guardian-team-at-govtech-singapore-3758cf21004d)
- [GovInsider: "Singapore solved the AI governance paralysis. Here's how"](https://govinsider.asia/intl-en/article/singapore-solved-the-ai-governance-paralysis-heres-how)
- [GovTech Singapore: Engineering Responsible AI](https://www.tech.gov.sg/technews/engineering-responsible-ai/)

**What they built**: AI Guardian is a division within GovTech Singapore (est. July 2024) that operationalizes AI safety through two products:
- **Litmus**: AI Testing-as-a-Service — a model-agnostic, multi-tenant platform for pre-deployment safety and security testing of GenAI applications.
- **Sentinel**: Guardrails-as-a-Service — continuous runtime monitoring and safeguarding of AI applications in production.

**Key insights from agency interviews** (Ben Goh's three findings):
1. Agencies were seeking **clear standards for AI testing** — different providers were offering conflicting recommendations. There was a need for a uniform benchmark, a "bar" to cross.
2. **Integration across agencies was not straightforward** due to varying tech stacks and use cases. The solution needed to be application- and model-agnostic.
3. Agencies needed not just testing, but **guardrails** — mechanisms to continuously monitor and safeguard AI applications in production.

**The Policy-Playbook-Product model**:
- **Policy**: Officers at the National AI Group set policies on AI use and governance.
- **Playbook**: AI practitioners at GovTech develop best practices and methodology.
- **Product**: Tools like Litmus and Sentinel empower execution of policies at scale.

**Traction**: ~1/3 of all government agencies actively use Litmus and Sentinel daily. Testing has evolved from static benchmarks to dynamic, context-evolving tests.

**What we learned for Evergreen**:
- The "technical capacity gap" framing: the gap between governance policy and its operationalization is the core problem.
- Model-agnostic, multi-tenant design is essential for cross-agency adoption.
- Pre-deployment testing and runtime guardrails are complementary — agencies need both.
- Co-design with non-technical officers is critical (they validated this at scale).
- Singapore's approach: implement in government first, build practitioner expertise, then that expertise transforms regulatory conversations from theoretical to operational.

---

## 2. Samiksha / Karya — Community-Driven AI Evaluation (India)

**Source**: Microsoft Research, Collective Intelligence Project (CIP), and Karya
- [Samiksha platform](https://evals.karya.in/samiksha/)
- [arXiv paper: "Building Benchmarks from the Ground Up: Community-Centered Evaluation of LLMs in Healthcare Chatbot Settings"](https://arxiv.org/abs/2509.24506)
- [IndiaAI: Samiksha Community Roundtable](https://x.com/OfficialINDIAai/status/2003758383808106983)
- [CIP: Democracy and AI Year in Review](https://blog.cip.org/p/from-global-dialogues-to-democratic)
- [CIP: The Road to the India AI Impact Summit](https://blog.cip.org/p/the-road-to-the-india-ai-impact-summit)

**What they built**: Samiksha is a community-driven evaluation pipeline that creates culturally grounded AI benchmarks by involving the people most affected by AI systems:
- **Civil-society organizations (CSOs)** with domain expertise and regional familiarity shape what gets evaluated.
- **Community data workers** (via Karya) curate benchmark queries and evaluate chatbot responses, drawing on their own lived experiences.
- Domains covered: healthcare, agriculture, education, legal.

**Three-phase pipeline**:
1. **Query Curation**: Semi-structured interviews with CSOs to capture domain expertise and identify what matters in their context.
2. **Benchmark Construction**: CSO insights are translated into task designs for paid community data workers who create the benchmark query dataset.
3. **Community Scoring**: The same community workers evaluate AI responses — assessing accuracy, safety, usefulness, clarity, and local relevance.

**Key findings**:
- Traditional benchmarks "often lack grounding in the lived realities of end users" — especially in non-Western, multilingual contexts.
- Community-driven evaluation is both feasible and produces better outcomes than expert-only approaches.
- The pipeline is being replicated internationally (Brazil, Uganda, Sri Lanka) — Sri Lanka's mini-version found major gaps in model performance for smaller nations.
- CIP launched Samiksha benchmarks with Anthropic at the India AI Impact Summit.

**What we learned for Evergreen**:
- **Members of the public / end users must be part of defining what "correct" looks like** — not just policy experts and program managers. This is the key update to our approach.
- Community-informed test cases catch failures that expert-only evaluations miss.
- The pipeline model (curate → construct → score) maps well to our Google Sheets → Eval Runner → Report flow, but we should make space for community input at each stage.
- Evaluation must be grounded in local realities: jurisdiction-specific, culturally aware, and multilingual.
- Paying community members for evaluation work (Karya model) is an ethical best practice.

---

## 3. UK AI Security Institute — Inspect Framework

**Source**: UK AISI (formerly AI Safety Institute)
- [Inspect documentation](https://inspect.aisi.org.uk/)
- [Inspect Evals library](https://inspect.aisi.org.uk/evals/)
- [GitHub: UKGovernmentBEIS/inspect_ai](https://github.com/UKGovernmentBEIS/inspect_ai)
- [AISI blog: "Announcing Inspect Evals"](https://www.aisi.gov.uk/blog/inspect-evals)
- [AISI blog: "Early lessons from evaluating frontier AI systems"](https://www.aisi.gov.uk/blog/early-lessons-from-evaluating-frontier-ai-systems)
- [Hamel Husain review](https://hamel.dev/notes/llm/evals/inspect.html)
- [Neurlcreators review](https://neurlcreators.substack.com/p/inspect-ai-evaluation-framework-review)

**What they built**: Inspect is an open-source Python framework for reproducible LLM evaluations, adopted by Anthropic, DeepMind, and major safety labs.

**Core architecture** (Dataset → Task → Solver → Scorer):
- **Dataset**: Test cases with inputs (prompts) and targets (correct answers).
- **Task**: Brings together a dataset, solver(s), and scorer into an evaluation recipe.
- **Solver**: Defines elicitation strategy — prompt engineering, chain-of-thought, tool use, agent scaffolds, critique-and-regenerate cycles.
- **Scorer**: Evaluates output — text comparison, model-graded (LLM-as-judge), custom validation.

**Design principles**:
- **Composition**: Custom solvers and scorers are standard Python packages — shareable and reusable across evaluations.
- **Typed & reproducible**: Everything is introspectable, logged, and auditable.
- **Async parallel execution**: Tunable parallelism for throughput under rate limits.
- **Sandboxed execution**: Model inference is separated from tool execution (Docker, Kubernetes, Proxmox).

**Key capabilities**:
- 100+ pre-built evaluations ready to run on any model.
- Multi-model support: OpenAI, Anthropic, Google, Mistral, local models (vLLM, Ollama).
- VS Code extension + web-based Inspect View for log analysis.
- Used by METR, Apollo Research, other government AISIs, and major safety labs.
- MIT licensed, 183+ contributors.

**What we learned for Evergreen**:
- The **Dataset → Task → Solver → Scorer** pipeline is elegant and composable — validates our similar architecture (Sheet → Runner → LLM → Grader → Report).
- **Composition as a design principle** — making components shareable and reusable — is important for cross-agency adoption.
- **Comprehensive logging** is essential for reproducibility and audit trails in government contexts.
- Inspect is powerful but engineering-heavy (Python, decorators, CLI) — our contribution is making a similar pipeline accessible to non-technical users via Google Sheets.
- Their community approach to evals (50+ contributors, shared eval library) suggests there's appetite for collaborative, open eval development.
- Inspect's model-agnostic provider abstraction confirms our approach of supporting multiple LLM backends.

---

## 4. Colorado Department of Labor and Employment (CDLE) — Benefits Chatbot Evals

**Source**: Propel / Dave Guarino — SNAP LLM Evals work applied to Colorado context
- Referenced in Propel's public documentation on state-level benefits AI evaluation

**What they did**: Applied expert-first evaluation methodology to a state benefits chatbot serving Colorado residents. Policy experts defined jurisdiction-specific test cases (Colorado SNAP rules, state-specific income thresholds, local application processes) and used eval tooling to assess chatbot accuracy before deployment.

**Key approach**:
- Test cases reflected Colorado-specific policy (not generic federal rules).
- Severity grading tied to real-world harm (incorrect eligibility determination = critical).
- Results used as a procurement/deployment gate.
- Four-dimension framework: factual accuracy, contextual understanding, practical navigation, communication quality.

**What we learned for Evergreen**:
- State-level variation is the norm, not the exception — evals must encode jurisdictional context.
- Expert-first, but the "experts" include people who administer programs and serve the public daily.
- Eval reports as procurement artifacts — leadership needs a clear pass/fail signal with severity context.
- The four-dimension framework is a practical methodology for non-technical teams.

---

## 5. Cross-Cutting Themes

### Where similar organizations have been successful

| Organization | Country | Key Success Factor | Scale |
|---|---|---|---|
| GovTech AI Guardian | Singapore | Policy-Playbook-Product model; model-agnostic SaaS | ~1/3 of government agencies |
| Samiksha / Karya | India | Community-driven benchmark creation; paid workers | Expanding to Brazil, Uganda, Sri Lanka |
| UK AISI Inspect | UK | Open-source, composable framework; lab adoption | 50+ contributors; used by Anthropic, DeepMind |
| CDLE / Propel | USA (CO) | Expert-first, jurisdiction-specific evals | State-level deployment gate |

### Converging insights across all research

1. **The technical capacity gap is the core problem.** Every organization identified the same challenge: governance frameworks exist, but operationalizing them requires tooling that bridges policy intent and technical execution.

2. **Who defines "correct" matters.** Moving from expert-only → expert + community produces better, more grounded evaluations. Singapore co-designs with officers. Samiksha co-designs with CSOs and community members. Propel co-designs with policy SMEs. Evergreen should include all three: policy experts, program managers, and members of the public.

3. **Model-agnostic is non-negotiable.** Singapore, UK AISI, and Propel all converged on this — agencies use different models, and the eval layer must sit above the model layer.

4. **Testing is not a one-time gate.** Singapore's Sentinel (runtime guardrails) and Inspect's continuous eval approach both point toward ongoing monitoring, not just pre-deployment checks.

5. **Composition and shareability drive adoption.** Inspect's package-based solvers/scorers and Singapore's multi-tenant SaaS both succeed because components can be reused across agencies and contexts.

6. **Local context is a first-class dimension.** Samiksha (India), CDLE (Colorado), and Singapore (agency-specific risk profiles) all validate that evaluations must be grounded in specific jurisdictions, cultures, and user populations.
