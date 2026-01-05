/**
 * Curare — Text embeddings via transformers.js
 */

import { pipeline } from '@xenova/transformers';
import { EmbeddingCache } from '../io/cache.js';

let extractor: any = null;

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

export interface EmbedOptions {
  model?: string;
  cache?: EmbeddingCache;
  onProgress?: (n: number, total: number, cached: number) => void;
}

export interface EmbedItem {
  id: string;
  text: string;
}

/**
 * Get embeddings for items with IDs (enables caching).
 */
export async function getTextEmbeddings(
  items: EmbedItem[],
  options: EmbedOptions = {}
): Promise<number[][]> {
  const model = options.model ?? DEFAULT_MODEL;
  const cache = options.cache;
  
  if (!extractor) {
    extractor = await pipeline('feature-extraction', model);
  }

  const results: number[][] = [];
  let cached = 0;

  for (let i = 0; i < items.length; i++) {
    const { id, text } = items[i];
    
    // Check cache
    const cachedEmb = cache?.get(id, text);
    if (cachedEmb) {
      results.push(cachedEmb);
      cached++;
    } else {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data as Float32Array);
      results.push(embedding);
      cache?.set(id, text, embedding);
    }
    
    options.onProgress?.(i + 1, items.length, cached);
  }
  
  return results;
}
