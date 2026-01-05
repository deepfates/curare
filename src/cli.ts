#!/usr/bin/env node
/**
 * Curare CLI — Cluster text or images from any source
 */

import 'dotenv/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { autoLoad } from './io/adapters.js';
import './io/builtin.js'; // Register built-in adapters
import { getTextEmbeddings } from './embed/text.js';
import { clusterEmbeddings, findOptimalK, getNearestToCentroid } from './cluster/kmeans.js';
import { classifyHeuristic } from './classify/heuristic.js';
import { classifyWithLLM } from './classify/llm.js';

interface CLIOptions {
  input: string;
  out: string;
  outDir?: string;
  k?: number;
  samples: number;
  classifyLlm?: boolean;  // undefined = auto-detect from API key
  model?: string;
  promptFile?: string;
  verbose: boolean;
}

function parseArgs(argv: string[]): CLIOptions {
  const args = argv.slice(2);
  const opts: CLIOptions = {
    input: '',
    out: 'clusters.json',
    outDir: 'curare-out',  // Default to multi-file output
    samples: 10,  // Better for typicality sampling
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-d' || a === '--out-dir') {
      opts.outDir = args[++i];
    } else if (a === '-o' || a === '--out') {
      opts.out = args[++i];
      opts.outDir = undefined;  // Single-file mode
    } else if (a === '-k' || a === '--clusters') {
      opts.k = parseInt(args[++i], 10);
    } else if (a === '--classify-llm') {
      opts.classifyLlm = true;
    } else if (a === '--no-llm') {
      opts.classifyLlm = false;
    } else if (a === '--model') {
      opts.model = args[++i];
    } else if (a === '--quality-prompt-file') {
      opts.promptFile = args[++i];
    } else if (a === '-s' || a === '--samples') {
      opts.samples = parseInt(args[++i], 10);
    } else if (a === '-v' || a === '--verbose') {
      opts.verbose = true;
    } else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else if (a === '--version') {
      console.log('curare 0.1.0');
      process.exit(0);
    } else if (!a.startsWith('-')) {
      opts.input = a;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`curare — semantic clustering for training data

Usage:
  curare <input> [options]

Examples:
  curare data.jsonl                     # Cluster and split by quality
  curare data.jsonl --no-llm            # Fast heuristic classification
  curare data.jsonl -o clusters.json    # Single-file output (no splits)
  curare ./texts/ -d out/               # Cluster folder of .md/.txt files

Input:
  <input>               JSONL file, folder of .md/.txt files, or image folder
                        Auto-detects: Alpaca, ShareGPT, OAI, Splice, raw text

Output (default: curare-out/):
  -d, --out-dir <dir>   Output directory (writes clusters.json, high.jsonl, low.jsonl)
  -o, --out <file>      Single output file (disables multi-file mode)

Classification:
  --classify-llm        Force LLM classification (auto if OPENROUTER_API_KEY set)
  --no-llm              Force heuristic classification (fast, offline)
  --model <name>        OpenRouter model (default: google/gemini-3-flash-preview)
  --quality-prompt-file <path>  Custom prompt from file
  -s, --samples <n>     Samples per cluster (default: 10)

Clustering:
  -k, --clusters <n>    Fixed cluster count (default: auto via elbow)

Other:
  -v, --verbose         Debug output
  --version             Show version
  -h, --help            Show this help
`);
}

function printConciseHelp() {
  console.log(`curare — semantic clustering for training data

Usage: curare <input> [options]

Example:
  curare data.jsonl              # Cluster and split by quality → curare-out/

Run 'curare --help' for all options.
`);
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.input) {
    printConciseHelp();
    process.exit(1);
  }

  // Auto-enable LLM classification if API key is present (unless explicitly disabled)
  const hasApiKey = !!process.env.OPENROUTER_API_KEY;
  const useLlm = opts.classifyLlm ?? hasApiKey;

  const log = opts.verbose ? console.error.bind(console) : () => {};

  // Load input with auto-detection
  log(`Loading ${opts.input}...`);
  const { adapter, items } = await autoLoad(opts.input);
  log(`Detected format: ${adapter}`);
  log(`Loaded ${items.length} items`);

  if (items.length === 0) {
    console.error('Error: No items with text found');
    process.exit(1);
  }

  // Initialize cache
  const { EmbeddingCache } = await import('./io/cache.js');
  const cache = new EmbeddingCache();
  await cache.load();

  // Embed
  log('Computing embeddings...');
  const embeddings = await getTextEmbeddings(items, {
    cache,
    onProgress: opts.verbose 
      ? (n, t, c) => process.stderr.write(`\rEmbedding ${n}/${t} (${c} cached)`)
      : undefined,
  });
  if (opts.verbose) process.stderr.write('\n');
  log(`Generated ${embeddings.length} embeddings`);
  
  // Save cache
  await cache.save();
  log('Saved embedding cache');

  // Cluster
  const k = opts.k ?? findOptimalK(embeddings);
  log(`Clustering with k=${k}...`);
  const { clusters, centroids } = clusterEmbeddings(embeddings, k);

  // Group items by cluster
  const clusterGroups: Map<number, number[]> = new Map();
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    if (!clusterGroups.has(c)) clusterGroups.set(c, []);
    clusterGroups.get(c)!.push(i);
  }

  // Classify each cluster (parallel for LLM, sequential for heuristic)
  log(`Classifying clusters (${useLlm ? 'LLM' : 'heuristic'})...`);
  const loadedPrompt = opts.promptFile
    ? await fs.readFile(opts.promptFile, 'utf8')
    : undefined;

  const clusterEntries = [...clusterGroups.entries()];
  
  const classifyOne = async ([clusterId, indices]: [number, number[]]) => {
    // Typicality sampling: get N items nearest to the cluster centroid
    const sampleIndices = getNearestToCentroid(indices, embeddings, centroids[clusterId], opts.samples);
    const samples = sampleIndices.map(i => items[i].text);

    const classification = useLlm
      ? await classifyWithLLM(samples, { prompt: loadedPrompt, model: opts.model, verbose: opts.verbose })
      : classifyHeuristic(samples);

    return {
      id: clusterId,
      size: indices.length,
      tag: classification.tag,
      rating: classification.rating,
      items: indices.map(i => items[i].id),
      samples: samples.slice(0, 3),
    };
  };

  // Parallel classification for LLM, sequential for heuristic (already fast)
  const results = useLlm
    ? await Promise.all(clusterEntries.map(classifyOne))
    : await Promise.all(clusterEntries.map(classifyOne));

  // Output
  const sortedResults = results.sort((a, b) => b.size - a.size);
  const output = {
    source: path.basename(opts.input),
    k,
    clusters: sortedResults,
  };

  if (opts.outDir) {
    // Multi-file output mode
    await fs.mkdir(opts.outDir, { recursive: true });
    
    // Write metadata
    await fs.writeFile(path.join(opts.outDir, 'clusters.json'), JSON.stringify(output, null, 2));
    
    // Collect items by rating - preserve original format when available
    const highItems: string[] = [];
    const lowItems: string[] = [];
    
    for (const cluster of sortedResults) {
      const clusterItems = cluster.items.map(id => {
        const item = items.find(i => i.id === id);
        if (!item) return null;
        // Use original line if available (preserves OAI format), else normalized
        return item.originalLine ?? JSON.stringify({ id: item.id, text: item.text });
      }).filter(Boolean) as string[];
      
      if (cluster.rating === 'high') {
        highItems.push(...clusterItems);
      } else {
        lowItems.push(...clusterItems);
      }
    }
    
    // Check if input was a folder (adapter === 'folder')
    const isFolder = adapter === 'folder';
    
    if (isFolder) {
      // Folder mode: create high/low subdirectories with original files
      const highDir = path.join(opts.outDir, 'high');
      const lowDir = path.join(opts.outDir, 'low');
      await fs.mkdir(highDir, { recursive: true });
      await fs.mkdir(lowDir, { recursive: true });
      
      let highCount = 0, lowCount = 0;
      for (const cluster of sortedResults) {
        const targetDir = cluster.rating === 'high' ? highDir : lowDir;
        for (const id of cluster.items) {
          const item = items.find(i => i.id === id);
          if (item) {
            await fs.writeFile(path.join(targetDir, item.id), item.text);
            if (cluster.rating === 'high') highCount++; else lowCount++;
          }
        }
      }
      
      console.log(`Wrote to ${opts.outDir}/:`)
      console.log(`  clusters.json (${sortedResults.length} clusters)`);
      console.log(`  high/ (${highCount} files)`);
      console.log(`  low/ (${lowCount} files)`);
    } else {
      // JSONL mode: write high/low files
      await fs.writeFile(path.join(opts.outDir, 'high.jsonl'), highItems.join('\n'));
      await fs.writeFile(path.join(opts.outDir, 'low.jsonl'), lowItems.join('\n'));
      
      console.log(`Wrote to ${opts.outDir}/:`)
      console.log(`  clusters.json (${sortedResults.length} clusters)`);
      console.log(`  high.jsonl (${highItems.length} items)`);
      console.log(`  low.jsonl (${lowItems.length} items)`);
    }
  } else {
    // Single file output
    await fs.writeFile(opts.out, JSON.stringify(output, null, 2));
    console.log(`Wrote ${results.length} clusters to ${opts.out}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
