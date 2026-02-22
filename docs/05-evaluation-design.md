# Evaluation Design Guide

This guide helps you design comprehensive evaluations using the Four-Dimension Framework. It's written for policy experts, program managers, and anyone who needs to decide what to test.

---

## The Four Dimensions

Every AI system that answers public questions should be tested across four dimensions:

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│  1. FACTUAL ACCURACY         │  │  2. CONTEXTUAL UNDERSTANDING │
│                              │  │                              │
│  Does the AI get the         │  │  Does the AI handle          │
│  facts right?                │  │  different situations         │
│                              │  │  correctly?                  │
│                              │  │                              │
│  Test with: contains, regex  │  │  Test with: contains +       │
│  Severity: usually critical  │  │  Context column              │
│  or high                     │  │  Severity: varies            │
└─────────────────────────────┘  └─────────────────────────────┘

┌─────────────────────────────┐  ┌─────────────────────────────┐
│  3. PRACTICAL NAVIGATION     │  │  4. COMMUNICATION QUALITY    │
│                              │  │                              │
│  Does the AI help people     │  │  Is the response clear,      │
│  take the right next step?   │  │  readable, and appropriate?  │
│                              │  │                              │
│  Test with: contains-all     │  │  Test with: llm-rubric       │
│  Severity: usually medium    │  │  Severity: usually low       │
│  or high                     │  │  or medium                   │
└─────────────────────────────┘  └─────────────────────────────┘
```

**Start with Dimension 1.** If the AI gets facts wrong, nothing else matters.

---

## Dimension 1: Factual Accuracy

These test cases check whether the AI provides correct information.

**What to test:**
- Numbers (rates, thresholds, limits)
- Dates (deadlines, effective dates)
- Names (agencies, programs, forms)
- Rules (eligibility criteria, requirements)

**How to write them:**

| Question | Expected Answer | Check Type | Severity |
|----------|----------------|------------|----------|
| What is the CO state income tax rate? | 4.4% | contains | critical |
| When is the CO tax filing deadline? | April 15 | contains | high |
| What form do I use for CO state taxes? | DR 0104 | contains | high |

**Where wrong answers cause harm:** Wrong factual information can lead people to miss deadlines, file incorrectly, lose money, or miss benefits they're entitled to.

---

## Dimension 2: Contextual Understanding

These test cases check whether the AI adjusts its answer based on the person's situation.

**What to test:**
- Same question with different contexts (different states, roles, situations)
- Edge cases that have different rules
- Situations where "it depends" is the honest answer

**How to write them:**

| Question | Expected Answer | Context | Check Type | Severity |
|----------|----------------|---------|------------|----------|
| Do I owe CO tax? | Depends on domicile and CO-source income | Remote worker, lives in another state | llm-rubric | high |
| Can I get unemployment? | Contract workers are generally not eligible for traditional UI | Was a 1099 contractor | contains | critical |
| When is my tax return due? | October 15 | Filing an extension | contains | high |

**Where wrong answers cause harm:** Ignoring context gives people the wrong answer for THEIR situation, even if the answer is technically correct for someone else.

---

## Dimension 3: Practical Navigation

These test cases check whether the AI helps people figure out what to do next.

**What to test:**
- "How do I..." questions
- Questions about process, steps, and requirements
- Questions about where to go or who to contact

**How to write them:**

| Question | Expected Answer | Check Type | Severity |
|----------|----------------|------------|----------|
| How do I file my CO tax return? | Revenue Online, paper form, tax software | contains-all | medium |
| Where do I apply for unemployment? | coloradoui.gov | contains | high |
| What documents do I need to file CO taxes? | W-2, 1099 | contains-all | medium |

**Where wrong answers cause harm:** Missing steps or wrong instructions waste people's time and can cause them to miss deadlines or submit incomplete applications.

---

## Dimension 4: Communication Quality

These test cases check whether the response is clear, readable, and appropriate in tone.

**What to test:**
- Reading level (can a non-expert understand it?)
- Tone (is it helpful, not condescending or overly technical?)
- Completeness (does it answer the actual question?)
- Appropriate caveats (does it recommend professional advice when needed?)

**How to write them:**

| Question | Expected Answer (rubric) | Check Type | Severity |
|----------|------------------------|------------|----------|
| What is the CO income tax rate? | Response should be 2-3 sentences, mention the specific rate, and be understandable at a 6th grade reading level | llm-rubric | low |
| My employer didn't withhold CO taxes. What do I do? | Response should acknowledge this is stressful, provide clear next steps, and recommend consulting a tax professional for their specific situation | llm-rubric | medium |

**Where wrong answers cause harm:** Confusing, overly technical, or dismissive responses erode trust in government services and prevent people from getting help they need.

---

## Gathering Input for Test Cases

The best evaluations combine three perspectives:

### 1. Policy Experts (You)
You know the rules. Start with:
- The most important facts in your domain
- The rules that are most commonly misunderstood
- The mistakes that would cause the most harm

### 2. Frontline Staff
They know what people ask. Talk to:
- Call center workers
- Help desk staff
- Case workers
- Reception or intake staff

Ask them: "What questions do you get asked most often? What questions are hardest to answer? What misinformation do you hear from people who tried to find answers online?"

### 3. Community Members / End Users
They know what actually helps. Ask:
- Did the answer make sense?
- Could you take action based on this answer?
- Was anything confusing or missing?
- What would you have wanted to know?

This isn't just a nice-to-have. Research from India's Samiksha project and community-driven evaluation work shows that test cases informed by end users catch failures that expert-only evaluations miss.

---

## Putting It All Together

For a first evaluation, aim for this distribution:

| Dimension | Test Cases | Severity Mix |
|-----------|-----------|-------------|
| Factual Accuracy | 3-4 | Mostly critical/high |
| Contextual Understanding | 2-3 | Mostly high |
| Practical Navigation | 2-3 | Mostly medium/high |
| Communication Quality | 1-2 | Mostly low/medium |
| **Total** | **8-12** | |

You can always expand later. The Sheet is a living document — add test cases as you learn what the AI gets wrong or as community feedback reveals new failure modes.

---

## Next Steps

- [Writing Test Cases](./03-writing-test-cases.md) — column-by-column instructions
- [Understanding Results](./04-understanding-results.md) — reading the report
- [Technical Reference](./06-technical-reference.md) — configuration options
