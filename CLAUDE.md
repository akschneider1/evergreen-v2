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

### Web App Routes
| Route | File | Purpose |
|-------|------|---------|
| `GET /` | `landing.html` | Landing page — hero, how it works, template cards |
| `GET /builder` | `builder.html` | Test Suite Builder — edit/create test cases |
| `GET /run` | `input.html` | Eval runner form (start an evaluation) |
| `GET /api/templates` | `server.ts` | JSON list of template presets |
| `GET /api/templates/:id` | `server.ts` | Single template with builder cases |
| `POST /api/export-sheet` | `server.ts` | Export builder cases as CSV |
| `POST /api/run` | `server.ts` | Start an eval job |
| `GET /api/status/:jobId` | `server.ts` | Poll job progress |
| `GET /report/:jobId` | `server.ts` | Serve completed report |
| `GET /api/capabilities` | `server.ts` | Returns enabled optional features (e.g. `langfuseEnabled`) |
| `POST /api/feedback` | `server.ts` | Submit thumbs up/down score to Langfuse for a test case |

### Key Source Files
- `src/builder.ts` — Conversion between `BuilderTestCase` and `SheetRow`, CSV export
- `src/presets/` — Built-in test suites (6 presets + blank + 2 demo); presets can define `personas` and multi-turn seeded `turns` — see `PresetSuite` interface in `src/presets/index.ts`
- `src/langfuse.ts` — Langfuse client helpers (`isLangfuseConfigured`, `makeLangfuseClient`, `getTraceUrl`)
- `src/report/generator.ts` — Single-file HTML report with remediation hints

## Constraints
- USWDS only for UI — no Tailwind, Bootstrap, or custom CSS frameworks
- Reports must be single-file, self-contained HTML (no external assets)
- Promptfoo is invoked as a subprocess — don't try to replace or import it
- No persistent storage — stateless by design
- `npm run test` uses fully synthetic data (mocked CSV + mocked Promptfoo output) — no API keys needed, no Google Sheet fetched; keep it that way
