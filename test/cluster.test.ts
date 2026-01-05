/**
 * Curare — Tests for clustering module
 */

import { describe, it, expect } from 'vitest';
import { clusterEmbeddings, findOptimalK, getNearestToCentroid } from '../src/cluster/kmeans.js';

describe('clusterEmbeddings', () => {
  it('clusters embeddings into k groups', () => {
    const embeddings = [
      [0, 0],
      [0.1, 0.1],
      [10, 10],
      [10.1, 10.1],
    ];
    
    const result = clusterEmbeddings(embeddings, 2);
    
    expect(result.k).toBe(2);
    expect(result.clusters).toHaveLength(4);
    expect(result.centroids).toHaveLength(2);
    
    // Items 0,1 should be in same cluster, 2,3 in another
    expect(result.clusters[0]).toBe(result.clusters[1]);
    expect(result.clusters[2]).toBe(result.clusters[3]);
    expect(result.clusters[0]).not.toBe(result.clusters[2]);
  });
});

describe('findOptimalK', () => {
  it('returns 2 for very small datasets', () => {
    const embeddings = [[0, 0], [1, 1]];
    expect(findOptimalK(embeddings)).toBe(2);
  });

  it('finds reasonable k for clustered data', () => {
    // 3 clear clusters
    const embeddings = [
      [0, 0], [0.1, 0], [0, 0.1],  // cluster 1
      [10, 0], [10.1, 0], [10, 0.1],  // cluster 2
      [0, 10], [0.1, 10], [0, 10.1],  // cluster 3
    ];
    
    const k = findOptimalK(embeddings, 5);
    expect(k).toBeGreaterThanOrEqual(2);
    expect(k).toBeLessThanOrEqual(4);
  });
});

describe('getNearestToCentroid', () => {
  it('returns indices sorted by distance to centroid', () => {
    const embeddings = [
      [0, 0],    // index 0: distance 0 from centroid
      [5, 5],    // index 1: distance 50 from centroid
      [1, 1],    // index 2: distance 2 from centroid
      [2, 2],    // index 3: distance 8 from centroid
      [10, 10],  // index 4: distance 200 from centroid
    ];
    const centroid = [0, 0];
    const indices = [0, 1, 2, 3, 4];
    
    const nearest = getNearestToCentroid(indices, embeddings, centroid, 3);
    
    // Should return 3 nearest: 0, 2, 3 (in that order)
    expect(nearest).toEqual([0, 2, 3]);
  });

  it('handles fewer items than requested', () => {
    const embeddings = [[0, 0], [1, 1]];
    const centroid = [0, 0];
    const indices = [0, 1];
    
    const nearest = getNearestToCentroid(indices, embeddings, centroid, 5);
    
    expect(nearest).toHaveLength(2);
    expect(nearest[0]).toBe(0); // closer
    expect(nearest[1]).toBe(1); // farther
  });
});
