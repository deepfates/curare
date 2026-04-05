# 🎯 curare

> *Precision curation for your data*

Semantic clustering for training datasets, with optional LLM quality rating. Feed it conversations, inspect clusters, and use a judge-backed high/low split when an LLM is configured.

## Install

```bash
git clone https://github.com/deepfates/curare
cd curare && npm install
```

## Usage

```bash
npx tsx src/cli.ts data.jsonl              # → curare-out/high.jsonl, low.jsonl when OPENROUTER_API_KEY is set
npx tsx src/cli.ts data.jsonl --no-llm     # Offline clusters-only output
npx tsx src/cli.ts ./texts/ -d out/        # Folder of .md/.txt files
```

Curare auto-detects your format and clusters semantically. Quality rating requires an LLM judge: set `OPENROUTER_API_KEY` or pass `--classify-llm`.

## How It Works

1. **Load** — Auto-detects format (Alpaca, ShareGPT, OAI, Splice, raw text, folders)
2. **Embed** — Local embeddings via transformers.js (cached)
3. **Cluster** — K-means with elbow method for optimal k
4. **Tag** — Offline mode emits cluster tags for inspection
5. **Rate/Split** — LLM mode classifies high/low quality and outputs `high.jsonl` and `low.jsonl` preserving original format

## Options

```
curare <input> [options]

Output:
  -d, --out-dir <dir>   Output directory (default: curare-out/); offline writes clusters.json only
  -o, --out <file>      Single file output (disables splits)

Classification:
  --classify-llm        Force LLM (auto if OPENROUTER_API_KEY set)
  --no-llm              Disable LLM quality rating (offline clusters-only mode)
  --quality-prompt-file Custom prompt for LLM
  --llm-concurrency <n> Max concurrent LLM requests (default: 4)
  -s, --samples <n>     Samples per cluster (default: 10)

Clustering:
  -k, --clusters <n>    Fixed k (default: auto via elbow)

Other:
  -v, --verbose         Debug output
  --version             Show version
  -h, --help            Show help
```

## Environment

```bash
OPENROUTER_API_KEY=...   # Enables LLM classification automatically
CURARE_EMBED_MODEL=...   # Optional embeddings model (default: Xenova/all-MiniLM-L6-v2)
```

## Background

Curare implements the clustering methodology from [**"I want to break some laws too"**](https://snats.xyz/pages/articles/breaking_some_laws.html), which builds on the [Minipile paper](https://huggingface.co/datasets/JeanKaddour/minipile). The key finding: careful data curation can match full dataset performance with a fraction of the data.

**The pipeline:**
1. Embed the dataset
2. Cluster with k-means (elbow method for optimal k)
3. Use LLM to classify clusters as high/low quality
4. Keep only the good stuff

**Key insights:**
- **Typicality sampling** — Curare selects samples *nearest to cluster centroids* rather than random samples. This gives the LLM the most representative examples of each cluster.
- **Quality over quantity** — The paper found diminishing returns past ~1000 high-quality examples. More data isn't always better.
- **Cluster inspection** — Use `--no-llm` or `-o clusters.json` to inspect cluster samples before committing to a judge-backed split.

**Tips for best results:**
- Use `--classify-llm` with a custom prompt (via `--quality-prompt-file`) tailored to your use case
- Increase samples with `-s 15` or `-s 20` for highly idiosyncratic content
- Start with `--no-llm` to quickly inspect clusters, then run with `OPENROUTER_API_KEY` or `--classify-llm` for a final split

## License

MIT
