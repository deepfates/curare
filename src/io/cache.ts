/**
 * Curare — Embedding cache
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

interface CacheEntry {
  model: string;
  embeddings: Record<string, number[]>;  // id -> embedding
}

const DEFAULT_CACHE_DIR = '.curare';

function hash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex').slice(0, 16);
}

export class EmbeddingCache {
  private cacheDir: string;
  private model: string;
  private data: CacheEntry | null = null;
  private dirty = false;

  constructor(cacheDir = DEFAULT_CACHE_DIR, model = 'all-MiniLM-L6-v2') {
    this.cacheDir = cacheDir;
    this.model = model;
  }

  private get cachePath(): string {
    return path.join(this.cacheDir, `embeddings-${this.model.replace(/\//g, '_')}.json`);
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.cachePath, 'utf8');
      this.data = JSON.parse(raw);
      // Invalidate if model changed
      if (this.data?.model !== this.model) {
        this.data = { model: this.model, embeddings: {} };
      }
    } catch {
      this.data = { model: this.model, embeddings: {} };
    }
  }

  get(id: string, text: string): number[] | undefined {
    const key = `${id}:${hash(text)}`;
    return this.data?.embeddings[key];
  }

  set(id: string, text: string, embedding: number[]): void {
    if (!this.data) this.data = { model: this.model, embeddings: {} };
    const key = `${id}:${hash(text)}`;
    this.data.embeddings[key] = embedding;
    this.dirty = true;
  }

  async save(): Promise<void> {
    if (!this.dirty || !this.data) return;
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(this.cachePath, JSON.stringify(this.data));
    this.dirty = false;
  }

  get stats(): { cached: number; total: number } {
    return {
      cached: Object.keys(this.data?.embeddings ?? {}).length,
      total: 0,
    };
  }
}
