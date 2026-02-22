# What Is Evergreen?

**Evergreen is a tool that helps you test an AI system before you deploy it.**

If your agency is about to launch a chatbot, virtual assistant, or any AI-powered tool that answers questions from the public, Evergreen helps you answer one question:

> **"Is this AI system safe and accurate enough to go live?"**

---

## Who Is This For?

**You don't need to be technical to use Evergreen.** It was built for:

- **Policy experts** who know the rules and regulations the AI should follow
- **Program managers** who need evidence that an AI vendor's product meets standards
- **Anyone** who needs to sign off on whether an AI system is ready for real people to use

You'll need a **technical colleague** (someone comfortable with a terminal) to run the actual evaluation command — but everything else happens in Google Sheets and a web browser.

---

## How It Works (The 45-Minute Version)

| Step | What You Do | Time |
|------|------------|------|
| 1 | **Copy** the Google Sheet template | 2 min |
| 2 | **Write** test cases — real questions the public would ask, plus the correct answers | 30 min |
| 3 | **Ask a technical colleague** to run `npx evergreen run` | 5 min |
| 4 | **Read** the HTML report in your browser | 10 min |
| 5 | **Decide** whether the AI system is ready to deploy | You |

The report is a concrete artifact you can share with leadership, procurement, or oversight bodies as evidence of due diligence.

---

## What's a "Test Case"?

A test case is just a question paired with what the correct answer should include. You write them in a Google Sheet.

For example, if you're testing a Colorado tax chatbot:

| Question | Expected Answer | Severity |
|----------|----------------|----------|
| What is the CO state income tax rate? | 4.4% | Critical |
| How do I file my CO tax return? | Must mention Revenue Online | Medium |
| Can I deduct federal taxes on my CO return? | Must NOT say "you cannot deduct" as a blanket statement | Critical |

That's it. You're the expert on what's correct — the tool handles the rest.

---

## What Does the Report Tell Me?

The report shows:

1. **Pass/fail for every test case** — did the AI give the right answer?
2. **Critical failures** — test cases where a wrong answer could cause real harm
3. **An overall recommendation** — ready to deploy, needs improvement, or not ready
4. **Details** — the AI's exact response and why it passed or failed

There are three views:
- **Summary** — for leadership and decision-makers
- **Analysis** — for operations teams
- **Details** — for technical staff who need to debug failures

---

## What Does Evergreen NOT Do?

- It does **not** monitor a live AI system (it's for pre-deployment testing)
- It does **not** build or host the AI system itself
- It does **not** replace your judgment — it gives you evidence to make a better decision

---

## Next Steps

- [Quickstart Guide](./02-quickstart.md) — set up and run your first evaluation
- [Writing Test Cases](./03-writing-test-cases.md) — how to write effective test cases
- [Understanding Results](./04-understanding-results.md) — how to read the report
