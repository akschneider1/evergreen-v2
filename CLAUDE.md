# Evergreen v2

Pre-deployment AI evaluation tool for non-technical public sector users.
All user-facing language must be plain English — no technical jargon.

## Commands
```
npm run build   # compile TypeScript → dist/
npm run dev     # run from source (ts-node, no build needed)
npm run test    # E2E pipeline test — no network or API calls
```

## Sheet Schema
5 columns: `Question` | `What to check` | `Context` | `Metric` | `Severity`
Metric values: `Safety` | `Accuracy` | `Ease of Use` | `Effectiveness` | `Emotion`
Grading logic (check type, rubric) is inferred from the metric in `src/config.ts` — test makers never specify it.

## Architecture
Google Sheet → CSV → SheetRow[] → Promptfoo YAML → subprocess eval → HTML report

Same 4-step pipeline runs in both CLI (`src/index.ts`) and web app (`src/web/server.ts`).

## Constraints
- USWDS only for UI — no Tailwind, Bootstrap, or custom CSS frameworks
- Reports must be single-file, self-contained HTML (no external assets)
- Promptfoo is invoked as a subprocess — don't try to replace or import it
- No persistent storage — stateless by design
- `npm run test` uses fully synthetic data (mocked CSV + mocked Promptfoo output) — no API keys needed, no Google Sheet fetched; keep it that way
