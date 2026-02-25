# Running a Test-Case Workshop

This guide explains how to involve policy experts and community members in building your test cases. You don't need a technical background to run this process — just a willingness to listen.

---

## Why This Matters

Test cases written in isolation tend to test what the AI *can* do, not what it *needs* to do. When you bring in the people who know the rules and the people who live with the consequences, you end up with a sheet that reflects real risk — not guesswork.

The goal is a 60–90 minute working session where a small group drafts 10–15 rows in the Google Sheet together.

---

## Who to Involve

You need two types of participants. Aim for 1–3 people from each group.

| Type | Who They Are | What They Contribute |
|------|-------------|----------------------|
| **Policy experts / SMEs** | Program staff, policy analysts, legal staff, or subject-matter experts who know the rules | What the correct answers are; what the dangerous wrong answers are |
| **Community members / end users** | Residents who use or would use this service, frontline staff, call center workers, or advocates | How people actually ask questions; what makes an answer feel helpful vs. useless |

If you can only involve one group, start with frontline staff — they sit at the intersection of both worlds.

---

## Before the Session

- [ ] Make a copy of the [Google Sheet template](https://docs.google.com/spreadsheets/d/1ysiHznH64SB9CjedjVnZOg5YkMrPyYofSAXXHXa0w0I/edit?usp=sharing) and set sharing to "Anyone with the link can edit"
- [ ] Write a one-sentence description of the AI system: *"This chatbot helps Colorado residents check the status of their state tax refund."*
- [ ] Prepare 2–3 example rows in the sheet so participants can see what a finished test case looks like
- [ ] If possible, bring a laptop where you can show the AI responding to a question live

---

## Running the Session

### Introduction (10 minutes)

Explain what you're doing and why their input matters:

> *"We're about to give residents access to an AI assistant that answers questions about [topic]. Before we do that, we want to make sure it gives correct, safe, and helpful answers. You're here because you know things the technology team doesn't. We're going to use your knowledge to build a checklist — and if the AI fails the checklist, it doesn't go live."*

If you can, show the AI answering a question live. This helps ground the conversation.

---

### With policy experts (20 minutes)

Ask:

- *"What are the top five questions residents ask about [topic]?"*
- *"What's the most dangerous wrong answer this AI could give?"*
- *"Is there anything that's technically correct but still misleading in practice?"*
- *"Are there situations where the right answer depends on who's asking?"*

Capture answers directly in the **Question**, **What to Check**, and **Context** columns as you go. Don't worry about the **Metric** and **Severity** columns yet.

---

### With community members (20 minutes)

Ask:

- *"What would make you not trust an answer from this system?"*
- *"Has there ever been a time when you got information from a government website or phone line that was confusing or wrong? What happened?"*
- *"If you were stressed or frustrated, what would you need this system to do?"*
- *"Is there anything this AI absolutely should not say or promise?"*

These responses often point toward **Emotion**, **Ease of Use**, and **Safety** test cases.

---

### Live drafting (20–30 minutes)

Work through the rows together. Use the reference table below to fill in the **Metric** and **Severity** columns for each case you've collected.

It's fine if the session produces 8–12 solid rows. Quality beats quantity.

---

### Wrap-up (10 minutes)

Close by explaining what happens next:

> *"We'll run this checklist against the AI system. If it passes everything, it can go live. If it fails anything — especially on Safety — we go back to the development team before any real person uses it. The test cases you helped write are what's keeping the public safe."*

---

## Reference: Workshop Outputs → Sheet Columns

Use this table to translate what participants say into the five columns.

| What participants say | Sheet column | How to write it |
|-----------------------|-------------|-----------------|
| A question a real person would ask | **Question** | Use the resident's exact words — not policy language |
| The correct, specific answer | **What to Check** | Include numbers, names, deadlines, exact terms |
| For Safety: a claim the AI must never make | **What to Check** | Describe the wrong/dangerous thing to avoid |
| A detail that changes the right answer | **Context** | e.g., *"Single parent, 3 children under 5"* |
| Type of risk (see below) | **Metric** | Safety / Accuracy / Ease of Use / Effectiveness / Emotion |
| How bad if the AI gets this wrong? | **Severity** | critical / high / medium / low |

**Mapping risk types to metrics:**

| If participants say… | Use this metric |
|----------------------|----------------|
| "It could give out wrong numbers / dates / rules" | **Accuracy** |
| "It could say something dangerous or promise something it can't deliver" | **Safety** |
| "It won't actually help someone get what they need" | **Effectiveness** |
| "It'll be confusing or use jargon people won't understand" | **Ease of Use** |
| "It'll feel cold or dismissive to someone who's scared or frustrated" | **Emotion** |

**Choosing severity:**

| Severity | When to use it |
|----------|---------------|
| **critical** | A wrong answer could cost someone money, delay benefits, or cause legal trouble |
| **high** | A wrong answer is seriously misleading but may not cause direct harm |
| **medium** | A wrong answer is unhelpful but unlikely to cause harm |
| **low** | A minor quality issue — incomplete or slightly unclear |

---

## After the Session

1. Review the sheet for duplicates and make sure every row has all five columns filled in
2. Check that you have **at least 2 Safety rows** — these are the most important and the first thing reviewers look at
3. Share the sheet URL with the person running the evaluation
4. Keep a copy of any notes or quotes from participants — these can help explain results when you present findings to leadership

---

## Tips for Inclusive Sessions

- **Offer the session in the language participants are most comfortable with.** The sheet itself is in English, but the conversation doesn't have to be — someone can translate as you type.
- **Allow written input.** Some participants may prefer to write answers on paper or in a shared doc rather than speak aloud. Both work.
- **Be explicit that participants are the experts, not the technology team.** The AI was built by engineers; the people in the room know whether it will actually help real people.
- **If you're working with vulnerable populations** (people with disabilities, non-English speakers, people in financial distress), consider partnering with a trusted community organization to recruit participants and co-facilitate.

---

## Next Steps

- [Writing Test Cases](./03-writing-test-cases.md) — detailed guidance on each column
- [Understanding Results](./04-understanding-results.md) — how to read and present the report
