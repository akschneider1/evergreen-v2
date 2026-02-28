# Running a Test-Case Workshop

This guide explains how to involve policy experts and community members in building your test cases. You don't need a technical background to run this process — but you do need a genuine commitment to listening.

The underlying principle is this: **test cases written in isolation tend to test what the AI can do, not what it needs to do.** The people who know the rules and the people who live with the consequences will catch failures that an expert sitting alone at a desk will miss. Research from India, Singapore, and Colorado all confirm this. This guide puts that principle into practice.

---

## Who to Involve

You need two types of participants. Aim for 2–4 people from each group. Fewer than that and you risk missing important perspectives; more than six total and the session becomes hard to manage.

| Type | Who They Are | What They Contribute |
|------|-------------|----------------------|
| **Policy experts / SMEs** | Program staff, policy analysts, legal staff who know the rules | What the correct answers are; what the dangerous wrong answers look like; where the rules are misunderstood |
| **Community members / end users** | Residents who use or would use this service, frontline call center workers, or community advocates | How people actually ask questions; what makes an answer feel helpful vs. useless; what a cold or confusing response costs someone |

**If you can only involve one group**, start with frontline staff — they sit at the intersection of both worlds and know what real people ask.

**A note on mixing groups**: If possible, run your policy expert conversation and your community conversation **separately**. When officials and residents are in the same room, community voices often go unheard — not out of bad intent, but because the power difference is real and people feel it. If you must run a single combined session, plan explicit structures to protect community voices (see Facilitation below).

---

## Recruiting Participants

**Policy experts** are usually straightforward to recruit — reach out through your program team or agency contacts.

**Community members** require active outreach. Waiting for volunteers to come to you will give you an unrepresentative group. Strategies that work:

- **Partner with trusted organizations**: community nonprofits, faith institutions, legal aid offices, libraries, food banks, and tenant advocacy groups already have relationships with the communities you're trying to reach. Ask them to help identify and introduce participants.
- **Go where people already are**: community events, neighborhood centers, waiting rooms at social services offices, or wherever residents gather.
- **Compensate fairly**: Participants are giving you their time and expertise. Where budget allows, provide compensation — a gift card, transit fare, or small honorarium. If you can't pay, acknowledge the contribution explicitly and remove every other barrier you can (childcare, transportation, flexible scheduling).
- **Remove barriers**: offer multiple times including evenings and weekends; offer phone or video options if in-person travel is a burden; hold sessions at a trusted location, not a government office if that creates anxiety.
- **Be honest about what you're doing**: explain clearly that their input will be used to evaluate an AI system before real people use it, and that they are not being evaluated themselves.

> **Federal agencies:** Informal workshops with fewer than 10 participants generally do not require Paperwork Reduction Act (PRA) clearance, especially when questions are open-ended and one-on-one or small group. Check with your agency's counsel if you plan to run structured surveys or large-scale outreach.

---

## Before the Session

- [ ] Open the **Test Suite Builder** at `/builder` (or make a copy of the [Google Sheet template](https://docs.google.com/spreadsheets/d/1ysiHznH64SB9CjedjVnZOg5YkMrPyYofSAXXHXa0w0I/edit?usp=sharing)) — the Builder works well for in-person workshops where you can project the screen
- [ ] Write a one-sentence description of the AI system: *"This chatbot helps Colorado residents check the status of their state tax refund."*
- [ ] Prepare 2–3 example rows in the sheet so participants can see a finished test case
- [ ] Decide whether the facilitator will also be a subject-matter expert — if so, plan for a separate note-taker, because it's very hard to facilitate and contribute at the same time
- [ ] Bring something to take notes on — sticky notes and a whiteboard work well; a shared doc works for remote sessions; you want to capture what participants actually say, not your interpretation of it

---

## Running the Session

### Introduction (10 minutes)

Explain what you're doing and why their input matters. Use plain language:

> *"We're about to give residents access to an AI assistant that answers questions about [topic]. Before we do that, we want to make sure it gives correct, safe, and helpful answers. You're here because you know things the technology team doesn't. We're going to use your knowledge to build a checklist — and if the AI fails the checklist, it doesn't go live."*

**Get consent before you begin.** Tell participants:
- How their input will be used (to build AI test cases)
- Whether anything they say will be recorded or shared, and how
- That they can decline to answer any question and can leave at any time
- Whether they'll be identified by name anywhere, or whether their contributions will be anonymous

If you're recording or taking notes that will be shared, say so explicitly. Verbal consent is fine — you don't need a form — but you do need to ask.

**Facilitation principles:**
- The facilitator's job is to structure the conversation, not to contribute to it. If you have opinions about the right answers, hold them back — your job in this session is to listen.
- Explicitly invite quieter participants to speak: *"We haven't heard from everyone — [Name], what's your take?"*
- If one person is dominating, gently redirect: *"That's useful — let me hear from someone else before we go further."*
- Don't set ground rules without the group. Instead, ask at the start: *"What would help this conversation go well for everyone?"* This surfaces expectations without imposing norms that may not fit every participant's background.

---

### With policy experts (20 minutes)

Ask:

- *"What are the top five questions residents ask about [topic]?"*
- *"What's the most dangerous wrong answer this AI could give? What would it cost someone?"*
- *"Is there anything that's technically correct but still misleading in practice?"*
- *"Are there situations where the right answer depends on who's asking?"*
- *"What misinformation do you regularly hear from people who looked this up online or called a different office?"*

Capture what people say verbatim — the actual words they use, not your paraphrase of them. You'll synthesize later.

---

### With community members (20 minutes)

Ask:

- *"Tell me about a time you needed information from a government website or service. What happened?"*
- *"What would make you not trust an answer from a system like this?"*
- *"If you were worried or stressed, what would you need this system to do?"*
- *"Is there anything this AI absolutely should not say or promise?"*
- *"What words or phrases do you hear officials use that don't make sense to regular people?"*

These responses often surface **Emotion**, **Ease of Use**, and **Safety** test cases — the categories that expert-only evaluations most often miss.

Again: capture exact words, not summaries. If someone says *"It talked to me like I was stupid,"* write that down, not *"participant wanted a clearer tone."*

---

### Synthesis: from raw notes to test cases (20–30 minutes)

Before you start filling in the sheet, spend a few minutes organizing what you've heard. This step prevents you from only writing down the last things people said.

1. **Group related observations**: cluster your notes by theme. What came up repeatedly? What was surprising?
2. **Look for failures first**: what are the things that could go wrong? Safety failures, dangerous claims, confusing answers, cold responses to distressed users.
3. **Then look for variety**: make sure you have test cases across all five metrics, not just the ones that came up most in conversation.

Now fill in the Builder or sheet together. If using the Builder, the guided steps (metric → severity → question → criteria) make this process easier for first-time participants. Use the reference table below for the **Metric** and **Severity** fields.

---

### Wrap-up (10 minutes)

Close by telling participants what happens next:

> *"We'll run this checklist against the AI system. If it passes everything, it can go live. If it fails anything — especially on Safety — we go back to the development team before any real person uses it. The test cases you helped write are what's protecting the public."*

If you told participants their input was anonymous, confirm it will stay that way. If you're going to share a summary of the session's findings with anyone, tell them now.

---

## Reference: Workshop Outputs → Sheet Columns

Use this table to translate what participants say into the five columns.

| What participants say | Sheet column | How to write it |
|-----------------------|-------------|-----------------|
| A question a real person would ask | **Question** | Use the resident's exact words — not policy language |
| The correct, specific answer | **What to Check** | Include numbers, names, deadlines, exact terms |
| For Safety: a claim the AI must never make | **What to Check** | Describe the dangerous or wrong thing to avoid — not the right answer |
| A detail that changes the right answer | **Context** | e.g., *"Single parent, 3 children under 5"* |
| Type of risk (see below) | **Metric** | Safety / Accuracy / Ease of Use / Effectiveness / Emotion |
| How bad if the AI gets this wrong? | **Severity** | critical / high / medium / low |

**Mapping risk types to metrics:**

| If participants say… | Use this metric |
|----------------------|----------------|
| "It could give out wrong numbers, dates, or rules" | **Accuracy** |
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

1. **Write up a brief summary** — what themes came up, what surprised you, and any quotes that should inform future test cases beyond this session. Do this the same day while observations are fresh.
2. **Review the sheet**: make sure every row has all five columns filled in and that questions are in plain language (not policy language)
3. **Check your coverage**: aim for at least 2 Safety rows. If all your test cases are Accuracy, you're missing whole categories of risk.
4. **Anonymize before sharing**: if you share notes or quotes from the session, use participant codes (P1, P2) instead of names, and remove details that could identify someone.
5. Share the final sheet URL with the person running the evaluation.

---

## Tips for Inclusive Sessions

**Run an accessible process by default, not as a special accommodation:**

- **Language**: Offer sessions in the language participants are most comfortable with. The sheet is in English, but the conversation doesn't have to be — someone can interpret as you go. Don't assume English fluency.
- **Multiple ways to participate**: Some people prefer to write rather than speak. Allow written responses, typed input, or notes submitted before or after the session.
- **Location**: Hold sessions somewhere people feel comfortable — a community center, library, or familiar nonprofit — not a government office, if that creates anxiety or mistrust.
- **Logistics**: Offer flexible timing (evenings, weekends). Cover transportation if you can. Ask about childcare needs in advance.
- **Technology**: Don't assume internet access or a laptop. Phone participation or paper-based input should always be an option.
- **Power**: Be explicit that participants are the experts, not the technology team. The AI was built by engineers. The people in the room know whether it will actually help real people.
- **Intersectionality**: Many participants face multiple barriers — disability, language, income, geography — at the same time. Design the session to address them together, not one at a time.

**If you're working with communities that have historical reasons to mistrust government research** (this is more common than you might expect): be transparent about what you're doing and why, explain exactly how their input will be used, honor every commitment you make, and consider partnering with a trusted community organization to co-facilitate rather than leading the session entirely from inside government.

---

## Next Steps

- [Writing Test Cases](./03-writing-test-cases.md) — detailed guidance on each column
- [Evaluation Design](./05-evaluation-design.md) — the Five Lead Metrics framework
- [Understanding Results](./04-understanding-results.md) — how to read and present the report
