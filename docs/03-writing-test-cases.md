# Writing Test Cases

This guide explains how to write good test cases in Google Sheets. You don't need any technical background — just knowledge of your domain.

---

## The Basic Idea

A test case asks: **"If someone asks the AI this question, does the response include the right information?"**

Each row in your Google Sheet is one test case with five columns:

| Column | Question to Ask Yourself |
|--------|-------------------------|
| **Question** | What would a real person ask? |
| **Expected Answer** | What MUST the response include (or NOT include)? |
| **Context** | Is there a specific situation that changes the correct answer? |
| **Check Type** | How should the tool judge the response? |
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

### Expected Answer

This is what a correct response should include. It depends on your **Check Type** (see below):

| Check Type | What to Put in Expected Answer | Example |
|------------|-------------------------------|---------|
| `contains` | An exact word or phrase | `4.4%` |
| `not-contains` | A word or phrase that must NOT appear | `you cannot deduct` |
| `contains-all` | Multiple items, separated by commas | `Revenue Online, paper form, tax software` |
| `regex` | A pattern (ask your technical colleague) | `4\\.4%\|four point four` |
| `llm-rubric` | A description of what a good answer looks like | `The response should explain that CO has a flat tax rate and mention the specific percentage` |

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

### Check Type

This tells the tool HOW to judge the AI's response. Pick the one that fits:

| Check Type | In Plain English | Best For |
|------------|-----------------|----------|
| `contains` | The response must include this exact text | Specific numbers, names, URLs, dates |
| `not-contains` | The response must NOT include this text | Catching dangerous misinformation |
| `contains-all` | The response must include ALL of these items | Lists of required steps or elements |
| `regex` | The response must match this pattern | Flexible matching (ask your tech colleague) |
| `llm-rubric` | An AI judge scores the response against your description | Nuanced quality — tone, completeness, accuracy |

**When in doubt, start with `contains`.** It's the simplest and most predictable.

**Use `llm-rubric` when** the correct answer can't be reduced to a keyword — for example, "The response should acknowledge the complexity and recommend consulting a tax professional."

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

---

## How Many Test Cases Do I Need?

**Start with 5-10.** That's enough to get meaningful results and learn the process.

A good first set covers:

| Category | Count | Examples |
|----------|-------|---------|
| **Factual accuracy** (things with one right answer) | 3-4 | Tax rates, deadlines, eligibility thresholds |
| **Practical navigation** (how-to questions) | 2-3 | How to file, where to apply, what documents to bring |
| **Dangerous misinformation** (things it must NOT say) | 1-2 | Wrong eligibility, incorrect legal advice |
| **Nuanced judgment** (complex questions) | 1-2 | Situations that depend on context |

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
| Expected answer is the entire correct response | `contains` will fail if the AI words it differently | Focus on the KEY fact that must be present |
| Too many `llm-rubric` test cases | LLM-as-judge is slower and less predictable | Use `contains` when you can |

---

## Next Steps

- [Understanding Results](./04-understanding-results.md) — how to read what the report tells you
- [Evaluation Design](./05-evaluation-design.md) — the four-dimension framework for comprehensive testing
