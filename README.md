# 🎯 curare

> *A small, sharp tool for butchering your data*

Semantic clustering + quality rating for training datasets. Feed it conversations, get back high/low quality splits.

## Install

```bash
git clone https://github.com/deepfates/curare
cd curare && npm install
```

## Usage

```bash
npx tsx src/cli.ts data.jsonl              # → curare-out/high.jsonl, low.jsonl
npx tsx src/cli.ts data.jsonl --no-llm     # Fast heuristic (offline)
npx tsx src/cli.ts ./texts/ -d out/        # Folder of .md/.txt files
```

**That's it.** Curare auto-detects your format, clusters semantically, rates quality, and splits.

## How It Works

1. **Load** — Auto-detects format (Alpaca, ShareGPT, OAI, Splice, raw text, folders)
2. **Embed** — Local embeddings via transformers.js (cached)
3. **Cluster** — K-means with elbow method for optimal k
4. **Rate** — LLM or heuristic classification (high/low quality)
5. **Split** — Outputs `high.jsonl` and `low.jsonl` preserving original format

## Options

```
curare <input> [options]

Output:
  -d, --out-dir <dir>   Output directory (default: curare-out/)
  -o, --out <file>      Single file output (disables splits)

Classification:
  --classify-llm        Force LLM (auto if OPENROUTER_API_KEY set)
  --no-llm              Force heuristic (fast, offline)
  --quality-prompt-file Custom prompt for LLM
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
OPENROUTER_API_KEY=...   # Enables LLM classification
```

With the API key set, curare automatically uses LLM classification. Without it, falls back to fast heuristic.

## Library

```typescript
import { getTextEmbeddings, findOptimalK, clusterEmbeddings } from 'curare';

const embeddings = await getTextEmbeddings(items);
const k = findOptimalK(embeddings);
const { clusters, centroids } = clusterEmbeddings(embeddings, k);
```

## License

MIT
