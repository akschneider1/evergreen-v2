# Writing Test Cases

This guide explains how to write good test cases. You don't need any technical background — just knowledge of your domain.

You can write test cases in two ways:
- **Test Suite Builder** — built into Evergreen at `/builder`. Edit test cases visually with guided steps for metric, severity, question, and criteria.
- **Google Sheets** — use the template spreadsheet. Good for collaboration and when you want a shareable document.

Both methods produce the same result. The Builder is often easier for first-time users; Google Sheets is better for large teams editing together.

---

## The Basic Idea

A test case asks: **"If someone asks the AI this question, what kind of response should it give — and how do we check that?"**

Each test case has five fields (columns in a Google Sheet, or steps in the Builder):

| Column | Question to Ask Yourself |
|--------|-------------------------|
| **Question** | What would a real person ask? |
| **What to Check** | What should the response include (or avoid)? |
| **Context** | Is there a specific situation that changes the correct answer? |
| **Metric** | What kind of quality are we measuring? |
| **Severity** | How bad is it if the AI gets this wrong? |

---

## Column by Column

### Question

Write the question exactly as a real person would ask it — not how a lawyer or policy expert would phrase it.

| Instead of this | Write this |
|-----------------|-----------|
| "What is the applicable state income tax rate for Colorado residents for tax year 2024?" | "What is the Colorado state income tax rate?" |
| "Describe the eligibility criteria for unemployment insurance benefits" | "Can I get unemployment if I got fired?" |
| "What documentation is required for filing a state tax return?" | "What do I need to file my Colorado taxes?" |

**Tip:** Talk to frontline staff, call center workers, or community members. They know how people actually ask questions. This is the most important source for good test cases.

---

### Metric

The **Metric** tells Evergreen what kind of quality this test case measures. There are five options:

| Metric | What It Tests | When to Use It |
|--------|--------------|----------------|
| **Safety** | Does the response avoid a dangerous claim? | Whenever there's something the AI must NEVER say or imply |
| **Accuracy** | Does the response include the correct fact(s)? | Numbers, names, dates, rules — things with one right answer |
| **Effectiveness** | Does the response help the person accomplish their goal? | Process questions, multi-step situations, context-dependent answers |
| **Ease of Use** | Is the response clear and readable for a non-expert? | Checking whether plain language is used; no jargon |
| **Emotion** | Does the response handle sensitive situations with empathy? | Stressed, frustrated, or vulnerable users |

**Evergreen infers the grading logic from your metric choice** — you don't need to configure anything else. Just pick the metric that best describes what you're testing.

---

### What to Check

This is where you describe what a correct (or incorrect) response looks like. It works differently depending on your **Metric**:

| Metric | What to Put Here | Example |
|--------|-----------------|---------|
| **Safety** | Describe the dangerous claim the AI should NOT make | `response guarantees a specific delivery date` |
| **Accuracy** | The exact fact(s) that must appear. Separate multiple items with commas. | `4.4%` or `Revenue Online, paper form, tax software` |
| **Effectiveness** | Describe what a genuinely helpful response looks like | `Should advise checking Revenue Online and contacting DOR if there is no update` |
| **Ease of Use** | Optional — leave blank for a general plain-language check, or describe the specific quality | `uses numbered steps` |
| **Emotion** | Optional — leave blank for a general empathy check, or describe the specific tone expected | `Should acknowledge frustration and provide actionable next steps` |

**Safety works in reverse:** you describe the wrong answer, not the right one. Evergreen checks that the AI avoids making that claim.

**For Accuracy**, separate multiple required items with commas:

```
Revenue Online, paper form, tax software
```

All items must appear in the response to pass.

---

### Context (Optional)

Context is any situation that changes what the correct answer should be. This matters because the same question can have different right answers depending on who's asking.

| Question | Context | Why It Matters |
|----------|---------|----------------|
| "Do I owe CO tax?" | Remote worker, lives in another state | Answer depends on domicile vs. income source |
| "When is my tax return due?" | Filing an extension | Due date changes |
| "Can I get unemployment?" | Was a contract worker, not an employee | Eligibility rules differ |

If there's no special context, leave this column blank.

---

### Severity

How bad is it if the AI gets this wrong? This determines how the report prioritizes failures.

| Severity | What It Means | Examples |
|----------|--------------|---------|
| **critical** | Wrong answer could cause real harm — financial loss, denied benefits, legal trouble | Wrong tax rate, wrong eligibility rules, dangerous medical advice |
| **high** | Wrong answer is seriously misleading but may not cause direct harm | Wrong filing deadline, incorrect process steps |
| **medium** | Wrong answer is unhelpful but unlikely to cause harm | Missing one of several filing options, incomplete but not wrong |
| **low** | Wrong answer is a minor quality issue | Slightly verbose, missing a "nice to have" detail |

**Rule of thumb:** If a wrong answer could cost someone money, delay their benefits, or send them to the wrong place, it's **critical** or **high**.

> **Note:** All **Safety** failures are treated as deployment blockers regardless of severity. Even a low-severity Safety failure will prevent a "Ready for Deployment" verdict.

---

## How Many Test Cases Do I Need?

**Start with 5-10.** That's enough to get meaningful results and learn the process.

A good first set covers all five metrics:

| Metric | Count | Examples |
|--------|-------|---------|
| **Safety** | 1-2 | Things the AI must never claim or promise |
| **Accuracy** | 3-4 | Specific facts, rates, deadlines, eligibility rules |
| **Effectiveness** | 2-3 | How-to questions and context-dependent situations |
| **Ease of Use** | 1 | Whether the response is readable for a non-expert |
| **Emotion** | 1 | Whether the response handles a stressed user appropriately |
| **Total** | **8-11** | |

You can always add more test cases later. The Sheet is a living document.

---

## Where Should Test Cases Come From?

The best test cases come from three sources:

1. **Policy experts** — they know what the rules are and what the correct answers should be
2. **Frontline staff / call center workers** — they know what questions people actually ask
3. **Community members / end users** — they know what answers actually help (vs. answers that are technically correct but useless)

If you can, involve all three when writing your test cases. At minimum, review your questions with someone who talks to the public.

---

## Common Mistakes

| Mistake | Why It's a Problem | Fix |
|---------|-------------------|-----|
| Writing questions in formal policy language | Real users don't talk that way | Use plain language |
| Making all test cases `medium` severity | The report can't prioritize what matters | Be honest about impact |
| Only testing "happy path" questions | Misses the cases where AI is most dangerous | Add edge cases and "what if" scenarios |
| "What to Check" contains the entire correct response | Accuracy checks for exact matches | Focus on the KEY fact that must be present |
| All test cases use the same metric | Misses whole categories of failure | Cover all five metrics |
| Safety test describes the CORRECT answer | Safety is a negation test — it checks what to avoid | Describe the dangerous claim the AI must NOT make |

---

## Next Steps

- [Understanding Results](./04-understanding-results.md) — how to read what the report tells you
- [Evaluation Design](./05-evaluation-design.md) — the five lead metrics framework for comprehensive testing
