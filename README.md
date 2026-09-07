# 🎯 Curare

> *Find the shape of a text corpus before deciding what to keep.*

Curare groups related text and gives you examples from each group to inspect.
Use it to get your bearings in a collection of notes, conversations, or other
text records. You can choose the number of groups, compare their contents, and
optionally ask an OpenRouter model to judge which groups to keep.

Judging is coarse: the model sees examples nearest each cluster's center, and
its high/low rating applies to the whole cluster. Inspect the grouping before
using those ratings to split your data; unusual records may not resemble the
examples.

This is a private source application. Version `0.1.0` is a source checkpoint,
not an npm release, and the unscoped `curare` name on npm belongs to an
unrelated package.

## Try it: separate two kinds of writing

Requirements: Node.js 22 or newer and npm, in this source checkout.

This path makes no OpenRouter request, but `--no-llm` does not guarantee zero
network access. `npm install` accesses the npm registry. Curare also initializes
Transformers.js before consulting its per-item embedding cache, so it may
download `sentence-transformers/all-MiniLM-L6-v2` from Hugging Face unless the
model files are already cached. Embedding inference runs locally.

```sh
npm install
```

Save these eight records as `example.jsonl`:

```jsonl
{"id":"garden-1","text":"Tomato seedlings grow best in warm soil with steady watering."}
{"id":"garden-2","text":"Compost and leaf mulch improve the vegetable garden soil."}
{"id":"garden-3","text":"Prune the rose after flowering and water its roots deeply."}
{"id":"garden-4","text":"Basil seedlings need sunlight, moist soil, and room to grow."}
{"id":"software-1","text":"Cache keys must include model identity to avoid stale embeddings."}
{"id":"software-2","text":"A bounded worker queue limits concurrent network requests."}
{"id":"software-3","text":"Database transactions preserve consistency across failed writes."}
{"id":"software-4","text":"Retry logic should distinguish transient API failures from invalid input."}
```

Then cluster it with a fixed `k` so the result is easy to inspect:

```sh
npm start -- example.jsonl --no-llm -k 2 --seed 42 -d example-out
```

Open `example-out/clusters.json` and compare each cluster's `items` and
`samples`. With the default model, the four `garden-*` records should form one
cluster and the four `software-*` records another. `items` lists source ids;
`samples` lets you read the text nearest each cluster's center. These deliberately
distinct topics make the result easy to inspect. Your own collection may need a
different cluster count, and its groups may be less clear-cut.

There are no quality ratings or high/low files in this run: `--no-llm` produces
rough topic labels, not judgments about what is worth keeping.

### Check the no-judge behavior

The checked-in refusal fixture exercises that distinction:

```sh
npm start -- test/fixtures/offline-adversarial-refusal.jsonl \
  --no-llm -k 2 --seed 42 -d curare-out
node -e 'const x=require("./curare-out/clusters.json"); console.log(x.k, x.clusters.length, x.clusters.reduce((n,c)=>n+c.size,0), x.clusters.some(c=>"rating" in c))'
# 2 2 8 false
```

The output contains eight items in two clusters with seed `42`, no `rating`
fields, and no `high.jsonl` or `low.jsonl`. It tests the absence of an invented
quality judgment, not the usefulness of this particular grouping.

Curare stores per-item embeddings in `.curare/` in the current working directory.
That cache is separate from the Transformers.js model cache.

## Use your own data

```sh
# Local inspection without an OpenRouter judgment
npm start -- data.jsonl --no-llm -d curare-out

# Choose a fixed cluster count instead of the automatic elbow heuristic
npm start -- data.jsonl --no-llm -k 8 --seed 42 -d curare-out

# Judge whole clusters remotely and write high/low source-record splits
OPENROUTER_API_KEY=... npm start -- data.jsonl --classify-llm -d curare-out

# Preserve raw Lync ids and write separate cluster annotations
npm start -- corpus.lync --no-llm -d curare-out
```

Inputs may be a raw `.lync` log, JSONL in Alpaca, ShareGPT, OpenAI messages, or
`{id?, text}` form, or a directory of `.md`, `.markdown`, and `.txt` files. Run
`npm start -- --help` for the complete CLI reference.

Without `-k`, Curare tries a bounded range of cluster counts and chooses the
largest elbow distance from a line between the first and last measured
inertias. This is a deterministic heuristic for the supplied embeddings and
seed. Inspect the result and pass `-k` when the grouping is unsuitable.

## Why clusters first

Curare's cluster-first workflow is inspired by
[*I want to break some laws too*](https://snats.xyz/pages/articles/breaking_some_laws.html),
which adapts ideas from the
[Minipile dataset](https://huggingface.co/datasets/JeanKaddour/minipile): embed
the corpus, group nearby records, then inspect representative material before
deciding what to retain. Curare's implemented version is narrower than either
experiment. It uses text embeddings and centroid-near samples, and can ask an
LLM to judge each whole cluster; it does not reproduce their dataset creation,
training runs, or evaluations, and their reported results are not evidence that
Curare's partitions will improve a particular dataset.

## Outputs and effects

| Mode | Main outputs | External effect |
| --- | --- | --- |
| `--no-llm` | `clusters.json`; for Lync, `<input>.annotations.lync` | Curare makes no OpenRouter request. Transformers.js may still retrieve model files from Hugging Face; embedding inference runs locally. |
| `--classify-llm` | `clusters.json`, high/low records or directories, and judgment provenance | Representative samples are sent to OpenRouter. Provider availability, policy, and cost apply. |
| `-o <file>` | One cluster JSON file; no split or Lync annotation file | Same embedding and optional judging effects as the selected mode. |

For non-Lync multi-file judged runs, Curare also writes
`<input>.judgments.lore`. For Lync, rating and model provenance are included in
the annotation events instead.

Raw Lync input is handled as an append-only source. Curare rejects damaged or
conflicted logs, embeds only content accepted by the vendored Lync presentation
contract, preserves source event ids, and writes annotations separately; it
does not rewrite the source log. Events are enumerated by id in explicit UTF-8
byte order before seeded clustering. That order is for reproducibility, not
time or causality. See
[`vendor/lync-presentation/PROVENANCE.md`](vendor/lync-presentation/PROVENANCE.md)
for the vendored presentation boundary.

## Configuration

| Setting | Meaning |
| --- | --- |
| `OPENROUTER_API_KEY` | Enables remote cluster judging automatically unless `--no-llm` is passed. |
| `CURARE_EMBED_MODEL` | Replaces the default local embedding model; the first use may download it. |
| `--model <name>` | Selects the OpenRouter judge model. |
| `--quality-prompt-file <path>` | Replaces the default cluster-rating prompt. |
| `--llm-concurrency <n>` | Bounds concurrent OpenRouter requests; default `4`. |
| `--samples <n>` | Chooses up to this many items nearest each centroid for tagging or judging; default `10`. |

The repository's `custom_prompt.txt` is a Berduck-specific example, not the
default or a general quality standard. The default judge currently requests
`google/gemini-3-flash-preview`; the response or requested model name is stored
as judgment provenance.

## Troubleshooting

- **`No items with text found`:** confirm the first JSONL line has a
  supported shape, or that a folder contains supported text-file extensions.
  Non-Lync adapters currently skip malformed JSON lines; validate important
  inputs before treating item counts as complete.
- **Clustering fails for a fixed `-k`:** choose a positive cluster count no
  larger than the number of loaded text items.
- **Model loading or download fails:** check network access on first use and the
  configured `CURARE_EMBED_MODEL`. The `.curare/` directory caches embeddings,
  not the Transformers.js model files.
- **No high/low split appears:** `--no-llm` intentionally refuses to infer
  quality. Supply `OPENROUTER_API_KEY` and use `--classify-llm` only when sending
  representative samples to OpenRouter is acceptable.
- **A Lync log is refused:** repair or reconcile damaged/conflicting source
  events upstream. Curare does not silently drop them. Existing annotations and
  tombstones are valid but are not cluster material.
- **Rebuilding old Lync results:** regenerate from the raw source union. Do not
  combine annotations from pre-canonical-order runs with current regenerated
  annotations as if they were independent judgments.

## Development and project state

```sh
npm test
npm run build
```

Tests cover adapters, embedding/cache behavior, clustering determinism,
no-judge refusal to invent quality ratings, mocked OpenRouter response handling,
and Lync/Lore serialization.

Source-checkpoint changes and the release boundary are in
[`CHANGELOG.md`](CHANGELOG.md). Project-owned unfinished work is in
[`.tickets/`](.tickets/); the open heterogeneous-Lync ticket records the
still-missing per-kind reconciliation and named skip report.

Publication remains an owner decision. `package.json` must stay private unless
the owner chooses a scoped distribution identity and release contract; the
recorded release boundary also requires a fresh production security audit.

## License

MIT
