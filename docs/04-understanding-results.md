# Understanding Results

After running `npx evergreen run`, you'll get an HTML report. This guide explains how to read it and make decisions.

---

## Opening the Report

Open the `report.html` file in any web browser (Chrome, Firefox, Safari, Edge). The report is a single file — no internet connection needed to view it.

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

This is the tab you'll use most often. It shows:

### Readiness Badge

At the top of the report, you'll see one of three badges:

| Badge | What It Means | What to Do |
|-------|--------------|------------|
| **Ready for Deployment** (green) | All critical tests passed, overall pass rate is high | Proceed with deployment, schedule periodic re-evaluation |
| **Needs Improvement** (yellow) | No critical failures, but pass rate is below 80% | Review failures, tune the system prompt, re-run |
| **Not Ready for Deployment** (red) | There are critical failures | Do NOT deploy. Fix critical issues first |

### Stat Cards

- **Pass rate per provider** — percentage of test cases each LLM passed
- **Critical failures** — number of critical-severity test cases that failed
- **Total test cases** — how many tests were run

### Critical Failures

If any critical-severity test cases failed, they're listed here with:
- The question that was asked
- What the AI responded
- The real-world impact of getting this wrong

**These are the most important items in the report.** If there are critical failures, the system should not be deployed until they are resolved.

### Recommendation

A plain-language recommendation based on the results:
- Whether to deploy or not
- What to fix if not ready
- What to do next if ready

---

## Analysis Tab

This tab helps you understand WHERE the AI is strong and weak.

### Results by Evaluation Dimension

A bar chart showing pass rates across four dimensions:

| Dimension | What It Measures | Derived From |
|-----------|-----------------|-------------|
| **Factual Accuracy** | Does it get facts right? | `contains`, `not-contains`, `regex` test cases |
| **Practical Navigation** | Does it help people take the right next step? | `contains-all` test cases |
| **Communication Quality** | Is it clear, readable, appropriate? | `llm-rubric` test cases |
| **Contextual Understanding** | Does it handle variations in situation? | Test cases that have a Context column filled in |

If one dimension is significantly lower than others, that tells you where to focus improvement.

### Results by Severity

A table showing pass rates broken down by severity level. Look for:
- **Any failures in "critical"** — these are deal-breakers
- **Pattern in "high"** — multiple high-severity failures suggest a systemic issue

### Provider Comparison

If you tested multiple LLMs, this table compares them side by side on pass rate, critical failures, and average response length.

---

## Details Tab

This tab lists every test case in a table. Each row shows:

| Column | What It Shows |
|--------|--------------|
| **#** | Test case number |
| **Question** | The question that was asked |
| **Severity** | How impactful a wrong answer is |
| **Check Type** | How the response was graded |
| **Result** | PASS or FAIL for each provider |

Click **"Details"** on any row to expand it and see:
- **Expected**: what the correct answer should include
- **Response**: the AI's full response
- **Grading**: why it passed or failed

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
