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

## 4. Propel — SNAP LLM Evaluation Framework

**Source**: Dave Guarino / Propel — three-part blog series on building a public SNAP eval
- [Part 1: Domain expert testing and methodology](https://www.propel.app/insights/building-a-snap-llm-eval-part-1/)
- [Part 2: Testing and automation](https://www.propel.app/insights/building-a-snap-llm-eval-part-2-testing-and-automation/)
- [Part 3: Testing nuanced capabilities](https://www.propel.app/insights/building-a-snap-llm-eval-part-3-testing-nuanced-capabilities/)
- [Open-source 25-question eval dataset](https://github.com/nicepropel/snap-eval) (Google Sheets + GitHub)

**What they built**: A public, open-source LLM evaluation for SNAP (food stamps) — the first domain-specific eval designed to test whether frontier models can reliably answer benefits questions. Propel builds the leading mobile app for EBT balance checking (used by millions of SNAP recipients), so they have direct access to the questions real users actually ask.

**Methodology**:
- **Phase 1 — Domain expert testing**: A SNAP specialist extensively used multiple AI models and documented observations. Rather than jumping to automated tests, they prioritized capturing nuanced insights about where models fail. They built "Hydra," a Slack bot for rapid side-by-side model comparison.
- **Phase 2 — Automated testing with Promptfoo**: Selected Promptfoo specifically because it makes evals "more accessible to experts in topics that aren't software engineers." Test cases are managed in Google Sheets and run directly from there. Grading uses both keyword matching (for factual questions like "maximum benefit is $292") and LLM-as-judge (for nuanced criteria like "plain, accessible language at a 5th grade reading level").
- **Phase 3 — Nuanced capability testing**: Moved beyond factual knowledge to test four capability dimensions: factual knowledge, contextual understanding (state variation), practical navigation (applying, renewing, handling denials), and communication style (accessibility, actionable guidance).

**Key distinction — benchmarking vs. product development tests**:
- **Benchmarking tests** (consensus-based): Tolerant of model refusals when incorrect answers cause harm. Used to compare models.
- **Product development tests** (goal-specific): Penalize refusals more heavily in client-facing contexts. Used to evaluate deployment readiness.

**Results** (25-question eval, selected models):

| Model | Score |
|---|---|
| Gemini 2.5 Pro | 80% |
| Gemini 2.0 Flash | 80% |
| OpenAI o1 | 76% |
| Claude Sonnet 3.7 | 68% |
| GPT-4o Mini | 48% |

**Key findings**:
- Many models provide outdated SNAP income limits due to knowledge cutoffs — a strong argument for RAG in production.
- State-specific edge cases (asset limits vary by state; drug felony eligibility varies by state) challenged multiple models. The asset limit question is illustrative: the "correct" answer is $2,750 or $4,250, but the *useful* answer emphasizes that most applicants face no asset limit because only 13 states still enforce them.
- Models that excelled at factual knowledge sometimes struggled with navigation assistance — suggesting potential for routing questions to specialized models.

**What we learned for Evergreen**:
- **Promptfoo + Google Sheets is a proven eval stack for non-engineers** — Propel validated the exact pipeline Evergreen uses.
- **The four-dimension framework** (factual knowledge, contextual understanding, practical navigation, communication style) is a practical methodology for non-technical teams. This directly informs our five lead metrics.
- **State-level variation is the norm**, not the exception — evals must encode jurisdictional context.
- **Benchmarking vs. product tests is a useful distinction** — the same test case can serve different purposes depending on grading tolerance.
- **Open-sourcing evals invites domain expert feedback** — Propel released their 25-question dataset specifically to get corrections and extensions from SNAP experts.

---

## 5. Colorado CDLE / Stanford-Yale — Evaluating GenAI in Benefits Adjudication

**Source**: Magesh, Martin, Surani, Perez, Rodolfa, Ho (Stanford RegLab / Yale Tobin Center, January 2026)
- [Full paper (PDF)](https://tobin.yale.edu/sites/default/files/2026-01/CDLE_AI_Jan13_2026.pdf)
- Title: "Evaluating Generative AI in Benefits Administration: A Demonstration Project"

**What they did**: A collaboration between the US Department of Labor, the Colorado Department of Labor and Employment (CDLE), and Stanford/Yale researchers to co-design and rigorously evaluate a GenAI system for Unemployment Insurance (UI) adjudication. This is not a chatbot eval — it's an AI-assisted decision-making tool evaluated via a randomized controlled trial (RCT).

**The system**: A fine-tuned LLM (LLaMA-3 8B) trained on historical claims data to assist UI adjudicators with "fact finding" — the back-and-forth process of asking claimants and employers follow-up questions to determine benefit eligibility. Two components:
1. A **topic suggestion model** that identifies relevant follow-up areas from initial claim materials
2. A **question drafting model** that generates potential follow-up questions based on selected topics

**Evaluation methodology**:
- First comprehensive **sandbox environment** for AI evaluation in benefits administration — access to 3.3 million job separation issues with 486 million individual fact finding elements
- **Co-designed quality benchmarks** with adjudicators — expert-elicited scoring criteria, not generic metrics
- **Randomized controlled trial** comparing three conditions: AI-generated fact finding alone, adjudicator + AI, and adjudicator alone
- Quality assessed by CDLE's existing QA team using their established standards

**Key findings — a critical divergence**:
1. **Subjective satisfaction was high**: All 8 adjudicators rated the tool very or somewhat useful; 63% rated question quality as very good or excellent; 75% said they would use it regularly
2. **But no measurable improvement in quality or efficiency**: AI-assisted adjudicators showed statistically insignificant time savings (4 seconds, p=0.8) and no improvement in average quality scores vs. working alone
3. **AI alone outperformed historical baselines**: The model's unassisted output significantly exceeded the quality of historical questionnaires
4. **Potential to reduce variance**: The system may help less experienced adjudicators improve quality, reducing inter-adjudicator variability — addressing a core due process concern ("benefits roulette")
5. **Editing offset time savings**: Adjudicators spent considerable time editing AI-generated questions, neutralizing anticipated efficiency gains

**What we learned for Evergreen**:
- **Rigorous, context-situated evaluation is essential** — conventional benchmarks and vendor demos (which focused "almost exclusively on processing speed") fail to predict real-world effectiveness. This is the strongest academic evidence for why tools like Evergreen exist.
- **Subjective satisfaction ≠ objective improvement** — adjudicators loved the tool but it didn't measurably help them. This challenges the assumption that user satisfaction is a reliable proxy for system quality, and underscores the need for structured, outcome-based evaluation.
- **Co-designed quality criteria matter** — the researchers couldn't use generic metrics; they had to elicit expert judgment from adjudicators about what "good" looks like. This validates Evergreen's approach of having domain experts define test criteria.
- **Pre-deployment sandboxes are necessary but not sufficient** — the Hawthorne effect (participants performed better just by being observed) means sandbox results may not transfer to production. Complements our pre-deployment focus with an argument for ongoing evaluation.
- **Incorrect denials impose severe costs on vulnerable populations** — the paper explicitly frames harm in terms of real-world consequences, validating our severity-based grading approach.

---

## 6. UbuntuGuard — Culturally-Grounded Policy Benchmarks for African Languages

**Source**: Abdullahi, Mgonzo, Oduwole, Okewunmi, Owodunni, Singh, Eickhoff (2025)
- [arXiv paper: "UbuntuGuard: A Culturally-Grounded Policy Benchmark for Equitable AI Safety in African Languages"](https://arxiv.org/abs/2601.12696)
- Code repository: publicly available (CC-BY-4.0)

**What they built**: The first African-language policy-based safety benchmark. UbuntuGuard addresses the critical gap that most AI safety benchmarks prioritize Western contexts and high-resource languages, leaving African languages vulnerable to harm misclassification and cultural misalignment.

**Methodology**:
- **155 domain experts** from sensitive fields (including healthcare) authored adversarial queries
- **Context-specific safety policies** and reference responses reflecting cultural harm signals
- **13 models evaluated** — 6 general-purpose LLMs + 7 safety-focused models — across three variants: static, dynamic, and multilingual

**Key findings**:
1. **English-centric benchmarks overestimate real-world multilingual safety** — models appear safe in English but fail in African language contexts.
2. **Cross-lingual transfer offers only partial protection** — you can't just translate English safety into other languages.
3. **Dynamic models struggle to localize** African-language contexts despite better policy-leveraging capacity.
4. **Robust safety requires flexible, runtime-enforceable policies** tailored to local linguistic and sociocultural contexts.

**What we learned for Evergreen**:
- **Generic benchmarks are actively misleading** — they don't just miss context, they give false confidence. A model that "passes" on English-centric safety tests can fail badly for non-English-speaking populations.
- **Domain experts must author adversarial test cases**, not just expected-path queries. The 155-expert methodology validates our approach of having subject matter experts define what "wrong" looks like.
- **Static vs. dynamic testing matters** — UbuntuGuard's three variants (static, dynamic, multilingual) parallel Singapore's evolution from static benchmarks to dynamic, context-evolving tests.
- **Safety policies must be enforceable at runtime**, not just checked at deployment — reinforcing the need for both pre-deployment evals (Evergreen) and runtime guardrails (future work, a la Singapore's Sentinel).
- **Cultural context is not optional** — strengthens our Design Principle 2.4 (Context Is a First-Class Dimension) with empirical evidence that context-free evaluation is harmful.

---

## 7. Cross-Cutting Themes

### Where similar organizations have been successful

| Organization | Country | Key Success Factor | Scale |
|---|---|---|---|
| GovTech AI Guardian | Singapore | Policy-Playbook-Product model; model-agnostic SaaS | ~1/3 of government agencies |
| Samiksha / Karya | India | Community-driven benchmark creation; paid workers | Expanding to Brazil, Uganda, Sri Lanka |
| UK AISI Inspect | UK | Open-source, composable framework; lab adoption | 50+ contributors; used by Anthropic, DeepMind |
| Propel | USA | Promptfoo + Google Sheets eval for SNAP; open-source dataset | 25 test cases; 7 models benchmarked |
| CDLE / Stanford-Yale | USA (CO) | Co-designed GenAI for UI adjudication; RCT evaluation | 3.3M claims; 8 adjudicators; sandbox + trial |
| UbuntuGuard | Africa (multi) | Culturally-grounded safety benchmarks; expert-authored adversarial queries | 155 domain experts, 13 models, 3 test variants |

### Converging insights across all research

1. **The technical capacity gap is the core problem.** Every organization identified the same challenge: governance frameworks exist, but operationalizing them requires tooling that bridges policy intent and technical execution.

2. **Who defines "correct" matters.** Moving from expert-only → expert + community produces better, more grounded evaluations. Singapore co-designs with officers. Samiksha co-designs with CSOs and community members. Propel co-designs with SNAP policy specialists. The CDLE study co-designed quality benchmarks with adjudicators. Evergreen should include all of these: policy experts, program managers, front-line workers, and members of the public.

3. **Model-agnostic is non-negotiable.** Singapore, UK AISI, and Propel all converged on this — agencies use different models, and the eval layer must sit above the model layer.

4. **Subjective satisfaction ≠ objective quality.** The CDLE RCT found that adjudicators loved the AI tool but it didn't measurably improve their work. Vendor demos focused "almost exclusively on processing speed." This is the strongest argument for structured, outcome-based evaluation — which is what Evergreen provides.

5. **Testing is not a one-time gate.** Singapore's Sentinel (runtime guardrails), Inspect's continuous eval approach, and the CDLE finding that sandbox results may not transfer to production all point toward ongoing monitoring, not just pre-deployment checks.

6. **Composition and shareability drive adoption.** Inspect's package-based solvers/scorers, Singapore's multi-tenant SaaS, and Propel's open-source eval dataset all succeed because components can be reused across agencies and contexts.

7. **Local context is a first-class dimension.** Samiksha (India), Propel (state-specific SNAP rules), CDLE (Colorado UI adjudication), and UbuntuGuard (African languages) all validate that evaluations must be grounded in specific jurisdictions, cultures, and user populations.
