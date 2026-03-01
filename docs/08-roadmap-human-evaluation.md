# Roadmap: Human Evaluation Layer

**Status:** Research complete, not yet in development
**Last updated:** 2026-03-01

---

## Why This Matters

Evergreen currently runs fully automated evaluations: an LLM judge grades every AI response, and the report presents pass/fail verdicts. This works well for the 80% of cases where the answer is clearly right or wrong. But for the remaining 20% — safety-critical edge cases, culturally sensitive responses, ambiguous judgments — automated grading alone isn't enough.

The research is clear on this:

- LLM judges achieve 80-85% agreement with human experts on straightforward tasks, but drop 10-15% on domain-specific or culturally nuanced content ([Trust or Escalate, ICLR 2025](https://arxiv.org/abs/2407.18370))
- Changing who evaluates changes 14% of classifications ([Jury Learning, CHI 2022](https://dl.acm.org/doi/10.1145/3491102.3502004))
- Community-informed evaluations catch failures that expert-only approaches miss (Samiksha/Karya; see [RESEARCH.md](../RESEARCH.md))
- No government agency has yet run a public "evaluate our AI" program — this is an open opportunity

This roadmap describes three layered capabilities that bring human judgment into the evaluation loop — each building on the last.

---

## Overview

| Capability | Audience | Core UX | Builds On |
|------------|----------|---------|-----------|
| **Review Mode** | Expert reviewers, procurement officers | Agree/disagree with AI judge per test case | Existing report |
| **Session Mode** | UX researchers + participants | Structured rating protocol during moderated sessions | Review Mode |
| **Community Mode** | General public, constituents | One-click rating of AI responses, no account needed | Review Mode |

---

## Capability A: Review Mode

### What It Is

An interactive review layer added to the existing HTML evaluation report. When a reviewer opens the report, flagged test cases invite human judgment: confirm or override the AI judge's verdict, optionally add context. Ratings are saved locally and can be exported or shared.

This is the foundation — every other capability depends on it.

### User Stories

**US-A1: Procurement officer reviewing a vendor evaluation**
> As a procurement officer, I want to confirm or override the AI judge's verdict on each critical test case, so that my sign-off is based on human judgment, not just an algorithm's opinion.

**US-A2: Policy SME validating safety judgments**
> As a policy expert, I want to see which test cases the AI judge was least confident about, so I can focus my review time on the cases that need human eyes.

**US-A3: Technical lead calibrating the judge**
> As a technical implementer, I want to compare my pass/fail judgments against the AI judge's across a full evaluation, so I can measure how well the automated grading aligns with expert opinion and adjust rubrics accordingly.

**US-A4: Agency director reading a reviewed report**
> As a decision-maker, I want to see a summary that distinguishes "AI-graded" results from "human-confirmed" results, so I know which verdicts have been validated by a real person.

**US-A5: Reviewer documenting disagreement**
> As a reviewer, I want to add a short comment when I disagree with the AI judge, so the report captures why the automated grade was wrong and what the correct assessment should be.

### What the User Sees

**In the Details tab**, each test case row gains a review widget:

```
┌─────────────────────────────────────────────────────────────┐
│ #3  What is the CO state income tax rate?                   │
│     Critical · Accuracy · GPT-4o: PASS                      │
│                                                             │
│  ┌─ AI Response ──────────────────────────────────────────┐ │
│  │ The Colorado state income tax rate is 4.4%...          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ AI Grading ───────────────────────────────────────────┐ │
│  │ PASS — Response contains "4.4%"                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Human Review ─────────────────────────────────────────┐ │
│  │  Do you agree with the AI judge's verdict?             │ │
│  │  [ Agree ]  [ Disagree ]  [ Not Sure ]                 │ │
│  │                                                        │ │
│  │  Comment (optional): _________________________________ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**In the Summary tab**, a new "Review Progress" card shows:
- X of Y flagged cases reviewed
- Agreement rate: how often the human confirmed the AI judge
- Any overrides (cases where human said FAIL but AI said PASS, or vice versa)

**Flagging logic** — which cases are flagged for human review:
- All Safety-metric cases (regardless of pass/fail)
- All critical-severity failures
- A random 10% sample of passing cases (calibration)
- Cases where the LLM judge's grading reason is short or generic (low-confidence proxy)

### How Ratings Are Stored

**Default (no server):** `localStorage` keyed by a hash of the report contents. Ratings persist across browser sessions on the same machine. The report remains a single HTML file — ratings are an overlay, not embedded.

**With server running:** Ratings POST to `/api/ratings/:jobId`. Server stores them in the job object (in-memory, same 30-minute TTL as the report). When the report is re-fetched, ratings are injected into the HTML.

**Export:** A "Download Review Summary" button exports ratings as CSV:
```
test_number,question,metric,severity,ai_verdict,human_verdict,agreement,comment,reviewer,timestamp
3,"What is the CO state income tax rate?",accuracy,critical,pass,pass,yes,,Jane Smith,2026-03-01T14:30:00Z
7,"Can I deduct federal taxes?",safety,critical,fail,fail,yes,"Correct — response was dangerously wrong",Jane Smith,2026-03-01T14:32:00Z
```

### Implementation Sketch

**Files to modify:**
- `src/types.ts` — add `HumanRating` interface and optional `humanRatings[]` to `TestCaseResult`
- `src/report/generator.ts` — add review widget HTML/CSS/JS to Details tab expanded rows; add Review Progress card to Summary tab; add localStorage read/write logic; add CSV export
- `src/web/server.ts` — add `POST /api/ratings/:jobId` and `GET /api/ratings/:jobId` endpoints (optional, only when server is running)

**No new dependencies.** No database. No authentication. The report stays self-contained.

**Key design decisions:**
- Review widget is opt-in — it appears but doesn't block reading the report
- Ratings are per-reviewer (keyed by the evaluator name from the eval context, or "Anonymous")
- The report visually distinguishes AI-only verdicts from human-confirmed verdicts
- Agreement metrics use Cohen's Kappa when multiple reviewers rate the same cases

---

## Capability B: Session Mode

### What It Is

A structured evaluation protocol for moderated usability testing sessions. A UX researcher sits with one or more participants (policy SMEs, frontline staff, or community members) and walks through a curated subset of test cases. Evergreen provides the session structure, rating forms, and synthesis — the researcher provides the facilitation.

This builds on Review Mode's rating infrastructure but adds session management, participant tracking, and structured export.

### User Stories

**US-B1: UX researcher planning a session**
> As a UX researcher, I want to generate a session plan from an evaluation report that selects the most important test cases for review, so I can run a focused 60-minute session without having to manually curate cases.

**US-B2: UX researcher facilitating a session**
> As a UX researcher, I want to walk a participant through each selected test case, capture their rating and verbal feedback in real time, and move to the next case — all in one interface, so the session flows smoothly without switching tools.

**US-B3: Policy SME as session participant**
> As a policy expert participating in a review session, I want to see the AI's response to a realistic question from my domain and rate whether the response is correct and appropriate, so my expertise directly informs the evaluation.

**US-B4: Community member as session participant**
> As a member of the public participating in a review session, I want to see how the AI answered a question I might actually ask and tell the researcher whether the answer would have helped me, so my real-world perspective is captured.

**US-B5: UX researcher analyzing results**
> As a UX researcher, I want to export all session ratings and comments as a structured dataset, so I can analyze patterns, compare across participants, and include findings in my research report.

**US-B6: Program manager reading session findings**
> As a program manager, I want to see a summary of what human reviewers thought about the AI's performance — separate from what the AI judge scored — so I can weigh both signals when making deployment decisions.

### What the User Sees

**Session setup** (new page: `/review/:jobId`):

```
┌─────────────────────────────────────────────────────────────┐
│  Session Setup                                              │
│                                                             │
│  Session facilitator: [Jane Smith_________________]         │
│  Participant name:    [Maria Garcia________________]        │
│  Participant role:    ( ) Policy expert                     │
│                       ( ) Frontline staff                   │
│                       ( ) Community member                  │
│                       ( ) Other: ___________                │
│                                                             │
│  Cases to review:                                           │
│  [x] All safety cases (3)                                   │
│  [x] All critical failures (2)                              │
│  [x] Random calibration sample (3)                          │
│  [ ] All cases (25)                                         │
│                                                             │
│  Total: 8 cases · Est. 20 minutes                           │
│                                                             │
│  [ Start Session ]                                          │
└─────────────────────────────────────────────────────────────┘
```

**During the session** — one case at a time, full screen:

```
┌─────────────────────────────────────────────────────────────┐
│  Case 3 of 8 · Safety · Critical                    [Skip]  │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  Someone asked the AI:                                      │
│  "Can I deduct federal taxes on my Colorado return?"        │
│                                                             │
│  The AI responded:                                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Yes, Colorado allows you to deduct federal income      │ │
│  │ taxes from your state taxable income...                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ── Rating ──────────────────────────────────────────────── │
│                                                             │
│  Is this response accurate?                                 │
│  [ Definitely wrong ]  [ Somewhat wrong ]  [ Acceptable ]   │
│  [ Good ]  [ Excellent ]                                    │
│                                                             │
│  Would this response help the person?                       │
│  [ No — could cause harm ]  [ No — unhelpful ]              │
│  [ Somewhat ]  [ Yes ]  [ Absolutely ]                      │
│                                                             │
│  What would you have expected instead?                      │
│  [___________________________________________________]      │
│                                                             │
│  Facilitator notes:                                         │
│  [___________________________________________________]      │
│                                                             │
│  [ Previous ]                          [ Next Case → ]      │
└─────────────────────────────────────────────────────────────┘
```

**After the session** — summary + export:

```
┌─────────────────────────────────────────────────────────────┐
│  Session Complete                                           │
│                                                             │
│  Participant: Maria Garcia (Community member)               │
│  Cases reviewed: 8 of 8                                     │
│  Duration: 18 minutes                                       │
│                                                             │
│  Agreement with AI judge: 6 of 8 (75%)                      │
│  Overrides: 2 cases (both Safety)                           │
│                                                             │
│  [ Download Session CSV ]  [ Back to Report ]               │
└─────────────────────────────────────────────────────────────┘
```

### Session Rating Dimensions

Each case is rated on dimensions appropriate to its metric:

| Metric | Dimension 1 | Dimension 2 |
|--------|-------------|-------------|
| Safety | "Is this response safe?" (5-point) | "Could this cause harm?" (yes/no + severity) |
| Accuracy | "Is this factually correct?" (5-point) | "Is anything missing?" (free text) |
| Effectiveness | "Would this help the person?" (5-point) | "What's missing?" (free text) |
| Ease of Use | "Could a non-expert understand this?" (5-point) | "What's confusing?" (free text) |
| Emotion | "Is the tone appropriate?" (5-point) | "How would this make someone feel?" (free text) |

All cases also get:
- "Do you agree with the AI judge's verdict?" (agree / disagree / not sure)
- "What would you have expected instead?" (free text)
- Facilitator notes (free text)

### Implementation Sketch

**New files:**
- `src/web/review.html` — session setup + case-by-case review + summary/export page (single-page app, same pattern as builder.html)

**Files to modify:**
- `src/web/server.ts` — add `GET /review/:jobId` route; add `POST /api/sessions/:jobId` to store session data; add `GET /api/sessions/:jobId` to list sessions for a report
- `src/types.ts` — add `ReviewSession`, `SessionRating` interfaces
- `src/report/generator.ts` — optionally embed session summary data into report if sessions exist

**Session data model:**
```
ReviewSession {
  sessionId: string
  jobId: string
  facilitator: string
  participant: { name, role }
  startedAt: string (ISO)
  completedAt: string (ISO)
  ratings: SessionRating[]
}

SessionRating {
  testCaseNumber: number
  dimension1Score: number (1-5)
  dimension2Response: string
  agreesWithJudge: 'agree' | 'disagree' | 'unsure'
  expectedResponse: string
  facilitatorNotes: string
}
```

**Storage:** In-memory (same as jobs), with CSV export. Sessions are ephemeral by default — the export is the permanent artifact. The facilitator downloads the CSV at the end of the session.

---

## Capability C: Community Mode

### What It Is

A public-facing page where members of the general public can evaluate AI responses from a completed evaluation. No account, no login, no PII collected. The interface shows a question and the AI's response and asks simple rating questions. Aggregate ratings feed back into the report as "community confidence" scores.

This is modeled on [LMSYS Chatbot Arena](https://lmarena.ai/)'s proof that **one-click anonymous evaluation produces meaningful signal at scale**, adapted for domain-specific government AI evaluation. It also draws on the [Collective Intelligence Project's Weval platform](https://weval.org/), which enables community groups to contribute evaluations of AI systems.

### User Stories

**US-C1: Agency sharing an evaluation for public input**
> As a program manager, I want to share a link where members of the public can rate our AI chatbot's responses to real questions, so we can incorporate community feedback into our deployment decision.

**US-C2: Constituent evaluating a response**
> As a resident who uses government services, I want to see how an AI chatbot answered a question I might ask and say whether the answer would have helped me, so my perspective counts in whether this tool gets deployed.

**US-C3: Community advocate organizing feedback**
> As a community advocate, I want to share the evaluation link with my network and see how many people participated and what they thought, so I can represent community sentiment in public comment periods.

**US-C4: Agency analyzing community feedback**
> As a program manager, I want to see aggregated community ratings alongside the AI judge scores in my evaluation report, so I can identify cases where the public's assessment differs from the automated evaluation.

**US-C5: Technical lead using community signal**
> As a technical implementer, I want to identify test cases where community ratings are significantly lower than the AI judge's score, so I can investigate whether the judge is missing something that real users notice.

### What the User Sees

**Public evaluation page** (`/community/:jobId`):

```
┌─────────────────────────────────────────────────────────────┐
│  Evergreen · Community Evaluation                           │
│                                                             │
│  [Agency Name] is testing an AI tool that answers           │
│  questions about [topic]. Your feedback helps make          │
│  sure it works for real people.                             │
│                                                             │
│  ── Question 4 of 10 ──────────────────────────────────── │
│                                                             │
│  Someone asked:                                             │
│  "How do I apply for food assistance in Colorado?"          │
│                                                             │
│  The AI answered:                                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ To apply for food assistance (SNAP) in Colorado, you   │ │
│  │ can visit your county Department of Human Services...   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Was this answer helpful?                                   │
│  [ Not at all ]  [ Not really ]  [ Somewhat ]               │
│  [ Yes ]  [ Very helpful ]                                  │
│                                                             │
│  Would you trust this answer?                               │
│  [ No ]  [ Not sure ]  [ Yes ]                              │
│                                                             │
│  Anything wrong or missing? (optional)                      │
│  [___________________________________________________]      │
│                                                             │
│                                     [ Next Question → ]     │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  No account needed · No personal info collected             │
│  Your ratings help improve public services                  │
└─────────────────────────────────────────────────────────────┘
```

**Completion page:**

```
┌─────────────────────────────────────────────────────────────┐
│  Thank you!                                                 │
│                                                             │
│  You rated 10 responses. Your feedback has been recorded    │
│  and will be included in the evaluation report.             │
│                                                             │
│  XX people have contributed so far.                         │
│                                                             │
│  [ Rate More ]  [ Share This Link ]  [ Done ]               │
└─────────────────────────────────────────────────────────────┘
```

**In the main report** (new section in Summary or Recommendations tab):

```
┌─────────────────────────────────────────────────────────────┐
│  Community Feedback · 47 participants                       │
│                                                             │
│  Overall helpfulness: 3.8 / 5                               │
│  Overall trust: 72% said "Yes"                              │
│                                                             │
│  Cases with lowest community confidence:                    │
│  #7 — "Can I deduct federal taxes?" — 1.9 / 5 helpfulness  │
│  #4 — "How do I file my return?" — 2.4 / 5 helpfulness     │
│                                                             │
│  Cases where community disagrees with AI judge:             │
│  #12 — AI said PASS, community rated 2.1 / 5               │
│  #3  — AI said PASS, community rated 2.3 / 5               │
└─────────────────────────────────────────────────────────────┘
```

### Design Decisions

**What's shown to the public:**
- The question (from the test case)
- The AI's response (from the evaluation)
- NOT the expected answer (showing it would bias ratings)
- NOT the AI judge's verdict (showing it would anchor ratings)
- NOT severity or metric labels (unnecessary complexity for this audience)

**What's NOT collected:**
- No names, emails, or accounts
- No IP addresses stored (only used for rate limiting)
- No demographic data (optional future addition with explicit consent)
- No free-text that could contain PII is displayed publicly — only aggregated scores

**Safety and moderation:**
- Rate limiting: max 1 submission per case per session (cookie-based)
- Free-text comments are stored but never displayed publicly — only visible to the agency in the export
- No user-generated content is shown to other users
- The public page is read-only except for ratings — no way to inject content

**Case selection for public review:**
- The agency chooses which cases to include (not all 25 — maybe 8-12 representative ones)
- Safety-metric cases may be excluded from public view if the AI response itself is harmful
- Cases are presented in random order to avoid position bias

### Implementation Sketch

**New files:**
- `src/web/community.html` — public evaluation page (minimal, accessible, mobile-first)

**Files to modify:**
- `src/web/server.ts` — add `GET /community/:jobId` route; add `POST /api/community-ratings/:jobId` endpoint; add `GET /api/community-ratings/:jobId` for aggregation
- `src/types.ts` — add `CommunityRating`, `CommunityAggregation` interfaces
- `src/report/generator.ts` — add community feedback section to report when data exists

**Community data model:**
```
CommunityRating {
  jobId: string
  testCaseNumber: number
  helpfulness: number (1-5)
  trust: 'yes' | 'unsure' | 'no'
  comment: string (optional, never displayed publicly)
  sessionToken: string (anonymous, for deduplication)
  timestamp: string (ISO)
}

CommunityAggregation {
  jobId: string
  participantCount: number
  perCase: [{
    testCaseNumber: number
    avgHelpfulness: number
    trustPercent: number
    ratingCount: number
  }]
}
```

**Storage:** In-memory with periodic aggregation. Community ratings accumulate as long as the server is running. The agency can export raw ratings as CSV or view aggregated scores in the report. When the server stops, ratings are lost — but the export is the permanent record.

**Future consideration:** If Evergreen ever adds optional persistence (SQLite), community ratings would be the strongest motivator — they accumulate over days/weeks, not a single session.

---

## Sequencing

```
Phase 1: Review Mode                          Phase 2: Session Mode
┌──────────────────────────┐                  ┌──────────────────────────┐
│ Rating widget in report  │                  │ /review/:jobId page      │
│ Agree/disagree per case  │─── builds on ──→ │ Structured protocol      │
│ localStorage + CSV export│                  │ Per-participant tracking  │
│ Review Progress card     │                  │ Session CSV export       │
└──────────────────────────┘                  └──────────────────────────┘
                │
                │ builds on
                ▼
          Phase 3: Community Mode
          ┌──────────────────────────┐
          │ /community/:jobId page   │
          │ Public one-click ratings  │
          │ Aggregated scores in      │
          │   report                  │
          │ No login, no PII          │
          └──────────────────────────┘
```

**Phase 1 unblocks everything.** The rating data model, storage pattern, and CSV export are reused by Phases 2 and 3.

---

## Open Questions

1. **Should Review Mode ratings be embeddable in the HTML file itself?** Currently the report is a single self-contained file. Embedding ratings would let reviewed reports be shared with ratings included — but increases complexity.

2. **How do we handle multiple reviewers?** Review Mode could support multiple people reviewing the same report. Do we show all ratings, majority vote, or defer to the most senior reviewer?

3. **Should Community Mode be opt-in per test case?** The agency might want to exclude certain cases (e.g., safety cases with harmful AI responses) from public view.

4. **What's the minimum viable number of community ratings before showing aggregated scores?** Showing "1.0 / 5 from 1 person" is misleading. Probably need a threshold (10+ ratings per case) before displaying.

5. **Does community feedback change the readiness verdict?** If the AI judge says PASS but 40 community members say the response is unhelpful, should that flip the verdict? Or is community data advisory-only?

---

## Research References

- [Trust or Escalate: LLM Judges with Provable Guarantees (ICLR 2025)](https://arxiv.org/abs/2407.18370) — confidence-based routing, 80/20 split formalization
- [Jury Learning (CHI 2022)](https://dl.acm.org/doi/10.1145/3491102.3502004) — who evaluates changes 14% of outcomes
- [LMSYS Chatbot Arena](https://lmarena.ai/) — 800K+ crowdsourced votes, simplest viable public eval UX
- [Weval / Collective Intelligence Project](https://weval.org/) — community-authored AI evaluations, used by governments in India, Taiwan, Sri Lanka
- [DEF CON AI Village GRT](https://www.humane-intelligence.org/grt) — public red teaming evolution from CTF to structured exploratory reports
- [Anthropic Constitutional Classifiers Challenge](https://www.anthropic.com/news/model-safety-bug-bounty) — 339 participants, 300K interactions, $55K in bounties
- [Langfuse Annotation Queues](https://langfuse.com/docs/evaluation/evaluation-methods/annotation-queues) — structured human annotation with multi-score comparison
- [MetricMate (ACM 2025)](https://dl.acm.org/doi/10.1145/3729176.3729199) — interactive calibration of LLM judge criteria
- [UK CDDO AI Testing Framework](https://cddo.blog.gov.uk/2025/09/22/how-do-we-test-and-assure-ai-in-government/) — government AI testing and assurance methodology
- [GSA GenAI Chat Evaluation](https://oes.gsa.gov/projects/2533-evaluating-gen-ai-chat-tools/) — federal agency internal AI evaluation
- [Chatbot Usability Scale BUS-11](https://link.springer.com/article/10.1007/s00779-021-01582-9) — validated 11-item instrument for conversational AI evaluation
- [Evaluating Chatbot Architectures for Public Service Delivery (Frontiers 2025)](https://www.frontiersin.org/journals/political-science/articles/10.3389/fpos.2025.1601440/full) — 4-point rubric for government chatbots
