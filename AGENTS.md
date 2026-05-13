# pjt-alpha-hunter Operations

## Language
- Node.js / mjs
- Use web_fetch, Playwright (via browser tool), or public APIs where available.
- No external npm installs unless explicitly approved.

## Project Layout
- scripts/          → signal collection scripts (Node.js, mjs)
- data/             → raw JSON outputs
- reports/          → daily/weekly analysis reports
- specs/            → Ralph Mode specs

## Validation Gates
- Node run: node scripts/<script>.mjs
- Success: process exits 0 and writes JSON to data/
- No lint/typecheck for now (plain Node scripts).

## Rules
- Each script:
  - Single responsibility (one source).
  - Writes structured JSON to data/<source>_<YYYY-MM-DD>.json.
  - Logs minimal to console; do not print huge payloads.
- Use try/catch; on failure, log error and exit 1.
- Do not change other scripts unless explicitly required.
