/**
 * Curare — Tests for embedding cache
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmbeddingCache } from '../src/io/cache.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('EmbeddingCache', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curare-cache-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true });
  });

  it('returns undefined for uncached items', async () => {
    const cache = new EmbeddingCache(tempDir);
    await cache.load();
    
    expect(cache.get('id1', 'text')).toBeUndefined();
  });

  it('returns cached embedding after set', async () => {
    const cache = new EmbeddingCache(tempDir);
    await cache.load();
    
    const embedding = [0.1, 0.2, 0.3];
    cache.set('id1', 'some text', embedding);
    
    expect(cache.get('id1', 'some text')).toEqual(embedding);
  });

  it('persists cache to disk on save', async () => {
    const cache1 = new EmbeddingCache(tempDir);
    await cache1.load();
    cache1.set('id1', 'text', [1, 2, 3]);
    await cache1.save();

    // Load fresh cache
    const cache2 = new EmbeddingCache(tempDir);
    await cache2.load();
    
    expect(cache2.get('id1', 'text')).toEqual([1, 2, 3]);
  });

  it('invalidates cache if model changes', async () => {
    const cache1 = new EmbeddingCache(tempDir, 'model-v1');
    await cache1.load();
    cache1.set('id1', 'text', [1, 2, 3]);
    await cache1.save();

    // Load with different model
    const cache2 = new EmbeddingCache(tempDir, 'model-v2');
    await cache2.load();
    
    expect(cache2.get('id1', 'text')).toBeUndefined();
  });

  it('differentiates by text content (hash)', async () => {
    const cache = new EmbeddingCache(tempDir);
    await cache.load();
    
    cache.set('id1', 'text A', [1, 1, 1]);
    cache.set('id1', 'text B', [2, 2, 2]);
    
    expect(cache.get('id1', 'text A')).toEqual([1, 1, 1]);
    expect(cache.get('id1', 'text B')).toEqual([2, 2, 2]);
  });

  it('handles empty cache file gracefully', async () => {
    const cache = new EmbeddingCache(tempDir);
    await cache.load(); // No file exists yet
    
    expect(cache.get('any', 'any')).toBeUndefined();
  });
});
