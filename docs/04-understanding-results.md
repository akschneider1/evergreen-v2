# Understanding Results

After running `npx evergreen run`, you'll get an HTML report. This guide explains how to read it and make decisions.

---

## Opening the Report

The easiest way is to run the report server:

```bash
npx evergreen serve
```

Then open **http://localhost:4000** in any browser. Press `Ctrl+C` to stop.

You can also open `report.html` directly as a file in Chrome, Firefox, Safari, or Edge. The report is a single self-contained file — no server required to view it, though `evergreen serve` is more convenient.

---

## The Three Tabs

The report has three tabs, each designed for a different audience:

| Tab | For | What It Shows |
|-----|-----|--------------|
| **Summary** | Leadership, decision-makers | Pass rates, critical failures, go/no-go recommendation |
| **Analysis** | Operations, program managers | Breakdown by severity and evaluation dimension |
| **Details** | Technical staff | Every test case with full AI responses and grading reasons |

---

## Summary Tab

This is the tab for leadership and decision-makers. It is designed to give a fast, defensible go/no-go answer.

### Readiness Card

At the top of the Summary tab is a large coloured readiness card — the first thing you see:

| Colour | Status | Meaning |
|--------|--------|---------|
| Green | **Ready for Deployment** | All critical tests passed, overall pass rate ≥ 80% |
| Yellow | **Needs Improvement** | No critical failures, but pass rate is below 80% |
| Red | **Not Ready for Deployment** | One or more critical failures — do not deploy |

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

**These are the most important items in the report.** If there are critical failures, the system should not be deployed until they are resolved.

---

## Analysis Tab

This tab is for operations staff and program managers. It helps you understand **where** the AI is strong and weak, and what to do about it.

### Results by Evaluation Dimension

A bar chart showing pass rates across four dimensions. Each bar shows the percentage **and** the underlying count (e.g. "2/5 tests"):

| Dimension | What It Measures | Derived From |
|-----------|-----------------|-------------|
| **Factual Accuracy** | Does it get facts right? | `contains`, `not-contains`, `regex` test cases |
| **Practical Navigation** | Does it help people take the right next step? | `contains-all` test cases |
| **Communication Quality** | Is it clear, readable, appropriate? | `llm-rubric` test cases |
| **Contextual Understanding** | Does it handle variations in situation? | Test cases that have a Context column filled in |

If one dimension is significantly lower than others, focus your system prompt improvements there first.

A **pattern note** beneath the bars names the weakest dimension and suggests what to do.

### Results by Severity

A table showing pass rates by severity level, with inline progress bars for quick scanning. Each row is **clickable** — clicking a severity level jumps to the Details tab filtered to those test cases.

Look for:
- **Any failures in "critical"** — these are deal-breakers
- **Pattern in "high"** — multiple high-severity failures suggest a systemic issue

### Provider Comparison

If you tested multiple LLMs, this table compares them side by side on overall pass rate, critical failures, and pass rate per severity level.

---

## Details Tab

This tab is for technical staff who need to triage failures and understand grading logic.

### Filter Bar

Three filter buttons at the top let you narrow the table instantly:
- **All** — show every test case
- **Failures** — show only test cases where at least one provider failed
- **Critical** — show only critical-severity test cases

### Test Case Table

Each row shows:

| Column | What It Shows |
|--------|--------------|
| **#** | Test case number |
| **Question** | The question that was asked |
| **Severity** | How impactful a wrong answer is |
| **Check** | How the response was graded (`Contains`, `Not Contains`, etc.) |
| **Result** | PASS or FAIL for each provider |
| **▼** | Expand indicator |

Click **anywhere on a row** to expand it and see:
- **Expected** — what the correct answer should contain (highlighted in green)
- Per provider: the **full AI response** and the **grading reason**

### Grading Reasons

For simple assertions (`contains`, `not-contains`, `contains-all`), the grading reason now explains specifically what text was expected or should not have appeared — not just "Assertion failed". For `llm-rubric` tests, it shows the judge's full reasoning.

---

## Making a Decision

Use this framework:

```
┌─────────────────────────────────────────────────┐
│ Any critical failures?                           │
│                                                  │
│   YES → Do NOT deploy.                           │
│         Fix the critical issues, then re-run.    │
│                                                  │
│   NO → Check overall pass rate.                  │
│                                                  │
│        Below 80% → Needs work.                   │
│                    Tune system prompt or add      │
│                    retrieval, then re-run.        │
│                                                  │
│        80%+ → Consider deploying.                │
│               Share report with stakeholders.     │
│               Schedule periodic re-evaluation.    │
└─────────────────────────────────────────────────┘
```

---

## Sharing the Report

The report is a single HTML file. You can:

- **Email it** as an attachment
- **Upload it** to a shared drive
- **Print it** to PDF (use File > Print in your browser — it has print-friendly styles)

The report serves as a concrete artifact of due diligence for procurement, oversight, or leadership review.

---

## What to Do When Tests Fail

| If... | Then... |
|-------|---------|
| The AI gives wrong facts | The system prompt may need better instructions, or the AI may need access to authoritative data (retrieval-augmented generation) |
| The AI misses required information | Add the missing information to the system prompt or knowledge base |
| The AI says something it shouldn't | Add explicit instructions in the system prompt about what NOT to say |
| The AI's tone is wrong | Use `llm-rubric` test cases to grade tone and clarity |
| Many tests fail for one provider but not another | Consider using the provider that performs better |

After making changes, re-run `npx evergreen run` to see if the fixes worked.

---

## Next Steps

- [Evaluation Design](./05-evaluation-design.md) — how to design comprehensive evaluations
- [Technical Reference](./06-technical-reference.md) — all configuration options
