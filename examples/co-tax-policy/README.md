# Example: Colorado Tax Policy Chatbot

This example shows how a state agency could evaluate an AI chatbot that answers public questions about Colorado tax policy.

---

## The Scenario

The Colorado Department of Revenue is considering deploying an AI chatbot on their website to help taxpayers with common questions. Before launch, the policy team needs to verify the chatbot gives accurate, helpful answers.

---

## The Test Cases

Here are sample test cases covering all four evaluation dimensions:

| # | Question | Expected Answer | Context | Check Type | Severity |
|---|----------|----------------|---------|------------|----------|
| 1 | What is the Colorado state income tax rate? | 4.4% | | contains | critical |
| 2 | When is the CO tax filing deadline? | April 15 | | contains | high |
| 3 | What form do I use for CO state taxes? | DR 0104 | | contains | high |
| 4 | Can I deduct federal taxes on my CO return? | Must NOT say "you cannot deduct" as a blanket statement | CO-specific SALT rules | not-contains | critical |
| 5 | Do I owe CO tax if I work remotely for a CO company but live in another state? | Depends on whether you are domiciled in CO or have CO-source income | Remote worker, out-of-state employer | llm-rubric | high |
| 6 | How do I file my CO state tax return? | Revenue Online, paper form, tax software | | contains-all | medium |
| 7 | Where do I check my CO refund status? | Revenue Online | | contains | medium |
| 8 | What do I do if I can't pay my CO taxes on time? | payment plan, penalty | | contains-all | high |
| 9 | I'm a senior. Do I get any CO tax breaks? | The response should mention the pension/annuity subtraction and property tax/rent/heat credit, and be understandable to someone without tax expertise | Age 65+, retired | llm-rubric | medium |
| 10 | What is the sales tax rate in Denver? | The response should NOT claim there is a single rate; it should acknowledge that rates vary by jurisdiction and mention approximate combined rate | | llm-rubric | high |

Copy these into the [Google Sheet template](https://docs.google.com/spreadsheets/d/1ysiHznH64SB9CjedjVnZOg5YkMrPyYofSAXXHXa0w0I/copy) or create your own sheet with these columns.

---

## Running the Eval

1. Create a Google Sheet with the test cases above
2. Share it as "Anyone with the link can view"
3. Copy the Sheet ID from the URL
4. Edit `evergreen.yaml` in this folder — replace `YOUR_SHEET_ID_HERE` with your Sheet ID
5. Set your API key:
   ```bash
   export OPENAI_API_KEY=sk-your-key-here
   ```
6. Run:
   ```bash
   npx evergreen run -c examples/co-tax-policy/evergreen.yaml
   ```
7. Open `report.html` in your browser

---

## What to Look For

When reviewing the report:

- **Test cases 1, 4** are critical — wrong tax rates or blanket misinformation about deductions could cost taxpayers money
- **Test cases 5, 10** use `llm-rubric` for nuanced answers where there's no single "right" keyword
- **Test case 6** uses `contains-all` to verify the response mentions ALL filing methods, not just one
- **Test case 4** uses `not-contains` to catch a specific type of harmful oversimplification

---

## Adapting for Your Domain

Replace the Colorado tax questions with questions from your domain:

| Domain | Example Questions |
|--------|------------------|
| Unemployment insurance | "Can I get unemployment if I quit?", "How much will I receive?" |
| Benefits enrollment | "Am I eligible for SNAP?", "How do I apply for Medicaid?" |
| Permitting | "Do I need a building permit for a fence?", "How long does a permit take?" |
| Public health | "Where can I get a flu shot?", "Is the water safe to drink?" |

The process is the same: write questions real people ask, define what correct answers should include, and assign severity based on real-world impact.
