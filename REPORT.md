# dee-cura Report

Branch: `heuristic-honesty`

## Decision

Offline mode is now clusters-only. It writes cluster tags because the tag extractor is useful for inspection, but it does not assign `high` or `low` quality ratings and does not write split outputs.

Reasoning: the adversarial dataset in `VERDICT.md` shows that lexical quality heuristics reward long noun salad and penalize concise technical substance. That is not a tuning bug; it is a category error. Quality rating requires a judge, so Curare now says exactly that when `--no-llm` is passed or `OPENROUTER_API_KEY` is missing:

```text
quality rating requires a judge — set OPENROUTER_API_KEY or pass --classify-llm
```

I deleted the offline rating heuristic rather than hiding it behind `--unsafe-heuristic`. Keeping a knowingly bad rating path would preserve the same false promise under a different flag, and the LLM path does not need a heuristic fallback.

## Fix

- Removed offline high/low rating logic from `classifyHeuristic`; it now returns only `{ tag }`.
- Kept LLM classification unchanged for judge-backed `{ tag, rating }` results.
- Changed offline directory output to write only `clusters.json`.
- Suppressed `high.jsonl`, `low.jsonl`, `high/`, and `low/` in offline mode.
- Removed `rating` fields from offline `clusters.json`.
- Updated CLI help and README to describe clusters-only offline mode.
- Added `test/fixtures/offline-adversarial-refusal.jsonl` from `VERDICT.md`.
- Updated tests to assert offline refusal, clusters-only output, and no split files.

## Verification

Run:

```bash
npm test -- --run
```

Expected behavior for offline mode:

```bash
OPENROUTER_API_KEY= npx tsx src/cli.ts test/fixtures/offline-adversarial-refusal.jsonl --no-llm -k 2 -d /tmp/curare-offline-regression
```

The command writes `/tmp/curare-offline-regression/clusters.json`, prints the judge-required message, and does not create `high.jsonl` or `low.jsonl`.
