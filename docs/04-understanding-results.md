# Understanding Results

After running `npx evergreen run`, you'll get an HTML report. This guide explains how to read it and make decisions.

---

## Opening the Report

**If you used the web app** (`npx evergreen app`): the report opens automatically when the evaluation finishes. You can also click the **Download Report** button in the report header to save a copy. If you provided evaluation context (agency name, evaluator name, reason), these appear in the report header.

If the evaluation used a built-in test suite, the report includes an **Edit Test Cases** button that links back to the Builder — so you can refine your test cases and re-run.

**If you used the CLI** (`npx evergreen run`): start the report server:

```bash
npx evergreen serve
```

Then open **http://localhost:4000** in any browser. Press `Ctrl+C` to stop.

You can also open `report.html` directly as a file in Chrome, Firefox, Safari, or Edge. The report is a single self-contained file — no server required to view it, though `evergreen serve` is more convenient.

---

## The Three Tabs

The report has three tabs, designed as a sequence — start at the left and move right:

| Tab | For | What It Shows |
|-----|-----|--------------|
| **Report** | Leadership, decision-makers, compliance | Pass rates, critical failures, metric breakdown, all test case results — the full compliance artifact |
| **Engineering** | Technical staff | Per-test latency, token counts, and estimated cost pulled from Langfuse (requires Langfuse to be enabled) |
| **Recommendations** | Anyone | Actionable next steps organized by what type of change is needed: Prompt, Data, Model, or Process |

---

## Report Tab

This is the primary tab — the compliance artifact. It is one continuous scroll designed to give a fast, defensible go/no-go answer followed by all supporting evidence.

### Readiness Card

At the top is a large coloured readiness card — the first thing you see:

| Colour | Status | Meaning |
|--------|--------|---------|
| Green | **Ready for Deployment** | No Safety failures, all critical tests passed, overall pass rate ≥ 80% |
| Yellow | **Needs Improvement** | No Safety or critical failures, but pass rate is below 80% |
| Red | **Not Ready for Deployment** | One or more Safety failures OR critical failures — do not deploy |

Below the status, the card shows:
- A plain-language explanation of why the system received that verdict
- A **"What to do next"** list of concrete steps tailored to the result

### Stat Cards

Each card shows both the percentage and the underlying fraction:

- **Pass rate per provider** — e.g. "30% / 3 of 10 tests"
- **Critical failures** — count of critical-severity failures, out of how many critical tests ran
- **Total test cases** — total run, with passed/failed breakdown

### Critical Failures

If any critical-severity test cases failed, they appear here. Each failure shows:
- The question that was asked
- **Expected** — what the correct answer should have contained (green panel)
- **Actual** — what the AI responded (red panel)
- The real-world impact of getting this wrong
- **Suggested fix** — a plain-language recommendation tailored to the metric

**These are the most important items in the report.** If there are critical failures, the system should not be deployed until they are resolved.

### Results by Metric

A bar chart showing pass rates across all five lead metrics. Each bar shows the percentage and the underlying count (e.g. "2/5 tests"):

| Metric | What It Measures |
|--------|-----------------|
| **Safety** | Does the AI avoid dangerous claims or harmful implications? |
| **Accuracy** | Does the AI get specific facts, rates, and rules correct? |
| **Effectiveness** | Does the AI help the person accomplish their goal in their situation? |
| **Ease of Use** | Is the response clear and readable for a non-expert? |
| **Emotion** | Does the AI handle sensitive situations with appropriate empathy? |

If one metric is significantly lower than others, focus your system prompt improvements there first.

### Results by Severity

A table showing pass rates by severity level, with inline progress bars for quick scanning. Each row is **clickable** — clicking a severity level scrolls to the test case table filtered to those cases.

Look for:
- **Any failures in "critical"** — these are deal-breakers
- **Pattern in "high"** — multiple high-severity failures suggest a systemic issue

### Provider Comparison

If you tested multiple LLMs, this table compares them side by side on overall pass rate, critical failures, and pass rate per severity level.

### Test Case Table

The full list of all test cases, with filter bar and expandable rows.

**Filter bar:**
- **Status filters:** All / Failures / Critical
- **Metric filters:** one button per metric in the evaluation, each showing a count
- **Expand all / Collapse all** toggle on the right

**Each row shows:**

| Column | What It Shows |
|--------|--------------|
| **#** | Test case number |
| **Question** | The question that was asked |
| **Severity** | How impactful a wrong answer is |
| **Metric** | Which of the five quality dimensions this test measures |
| **Result** | PASS or FAIL for each provider |
| **▼** | Expand indicator |

Click **anywhere on a row** to expand it and see:
- **Expected** — what the correct answer should contain (highlighted in green)
- For multi-turn test cases: the full **conversation history** before the graded question
- Per provider: the **full AI response** and the **grading reason**

If Langfuse is enabled, each expanded row includes a thumbs up / thumbs down button to mark whether the grading was correct.

### Grading Reasons

For **Accuracy** tests, the grading reason explains which expected item was found or missing. For all other metrics (Safety, Effectiveness, Ease of Use, Emotion), the grading reason shows the LLM judge's full reasoning — including what criteria it evaluated and why the response passed or failed.

---

## Engineering Tab

This tab is for technical staff who want to understand model performance at a lower level. It requires Langfuse to be enabled when the evaluation ran.

When you click the Engineering tab, it loads live data from Langfuse for this specific run. You'll see:

- **Summary cards:** average latency, total tokens, estimated cost, number of tests traced
- **Model badge:** which model was used
- **Per-test table:** test number, pass/fail, metric, latency, token count
- **View full trace in Langfuse ↗** — a direct link to the full trace in your Langfuse dashboard

If Langfuse was not enabled for this evaluation, or if you're viewing a downloaded report offline, the tab shows a placeholder with a link to learn about Langfuse.

---

## Recommendations Tab

This tab is for anyone who wants to know what to do next. It synthesizes the evaluation results into layered, actionable next steps.

### Synthesis Line

At the top, a brief statement: your overall pass rate and whether any critical failures were found. This sets the context for everything below.

### Critical Block

If there are safety failures or critical-severity failures, they appear in a red alert block at the top — before any other recommendations — with explicit language that they must be resolved before deployment.

### Four Layers

Recommendations are organized into four sections, each addressing a different type of change:

| Layer | Description | Example |
|-------|-------------|---------|
| **Prompt** | Changes to how you instruct the AI | "Add plain language instructions (4 ease-of-use failures)" |
| **Data** | Changes to your test cases | "Review expected answers for accuracy test cases" |
| **Model** | Changes to which AI you are testing | "No model-layer concerns detected" |
| **Process** | Changes to your team's practices | "Have a subject matter expert review the critical failures" |

Each recommendation includes a **citation chip** showing the evidence behind it — e.g., "4 ease-of-use failures" — so you can trace it back to specific results in the Report tab.

Layers that have no issues show a green positive confirmation ("✓ No model-layer concerns detected") so you know you can skip them.

**Engineering enrichment:** If you've clicked the Engineering tab and Langfuse data loaded, the Prompt and Model layers may gain additional recommendations based on response verbosity (tokens) and latency — marked with "from live data."

---

## Making a Decision

Use this framework:

```
┌─────────────────────────────────────────────────┐
│ Any Safety failures?                             │
│                                                  │
│   YES → Do NOT deploy.                           │
│         Safety failures block deployment         │
│         regardless of severity. Fix, re-run.     │
│                                                  │
│   NO → Any critical failures?                    │
│                                                  │
│        YES → Do NOT deploy.                      │
│              Fix the critical issues, re-run.    │
│                                                  │
│        NO → Check overall pass rate.             │
│                                                  │
│             Below 80% → Needs work.              │
│                         Tune system prompt or    │
│                         add retrieval, re-run.   │
│                                                  │
│             80%+ → Consider deploying.           │
│                    Share report with             │
│                    stakeholders.                 │
│                    Schedule periodic re-evals.   │
└─────────────────────────────────────────────────┘
```

---

## Sharing the Report

The report is a single HTML file. You can:

- **Download it** directly from the report using the **Download Report** button in the header — saves the full report as a standalone HTML file
- **Email it** as an attachment
- **Upload it** to a shared drive
- **Print it** to PDF (use File > Print in your browser — it has print-friendly styles)

The report serves as a concrete artifact of due diligence for procurement, oversight, or leadership review. The Engineering tab will show a placeholder in downloaded/offline reports — only live server reports can load Langfuse data.

---

## What to Do When Tests Fail

| If... | Then... |
|-------|---------|
| The AI gives wrong facts | The system prompt may need better instructions, or the AI may need access to authoritative data (retrieval-augmented generation) |
| The AI misses required information | Add the missing information to the system prompt or knowledge base |
| The AI says something it shouldn't | Add explicit instructions in the system prompt about what NOT to say |
| The AI's tone is wrong | Use `Emotion` metric test cases to grade tone and empathy |
| Many tests fail for one provider but not another | Consider using the provider that performs better |

After making changes, re-run the evaluation to see if the fixes worked. In the web app, click **Edit Test Cases** in the report header to go back to the Builder, refine your test cases, then run again.

---

## Next Steps

- [Evaluation Design](./05-evaluation-design.md) — how to design comprehensive evaluations
- [Technical Reference](./06-technical-reference.md) — all configuration options
