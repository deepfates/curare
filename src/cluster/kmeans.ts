/**
 * Curare — K-means clustering via ml-kmeans
 */

import { kmeans } from 'ml-kmeans';

export interface ClusterResult {
  clusters: number[];      // Cluster index per item
  centroids: number[][];   // Centroid vectors
  k: number;
}

/**
 * Cluster embeddings using K-means.
 */
/**
 * Compute squared Euclidean distance between two vectors.
 */
function squaredDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return sum;
}

export function clusterEmbeddings(embeddings: number[][], k: number): ClusterResult {
  const result = kmeans(embeddings, k, { initialization: 'kmeans++' });
  return {
    clusters: result.clusters,
    centroids: result.centroids,
    k,
  };
}

/**
 * Get indices of items nearest to their cluster centroid (typicality sampling).
 * Returns up to `n` indices sorted by distance to centroid (ascending).
 */
export function getNearestToCentroid(
  indices: number[],
  embeddings: number[][],
  centroid: number[],
  n: number = 5
): number[] {
  const withDistances = indices.map(i => ({
    index: i,
    distance: squaredDistance(embeddings[i], centroid),
  }));
  
  withDistances.sort((a, b) => a.distance - b.distance);
  
  return withDistances.slice(0, n).map(d => d.index);
}

/**
 * Find optimal K using the elbow method.
 * Returns the K with maximum perpendicular distance from the line
 * connecting K=2 inertia to K=kMax inertia.
 */
export function findOptimalK(embeddings: number[][], kMax?: number): number {
  const n = embeddings.length;
  if (n < 3) return Math.min(n, 2);
  
  // Default kMax based on dataset size: cube root, clamped
  const maxK = kMax ?? Math.min(Math.max(3, Math.round(Math.pow(n, 1/3))), 50);
  const minK = 2;
  
  if (maxK <= minK) return minK;

  const inertias: number[] = [];
  
  for (let k = minK; k <= maxK; k++) {
    const result = kmeans(embeddings, k, { initialization: 'kmeans++' });
    
    // Compute inertia: sum of squared distances to centroids
    let inertia = 0;
    for (let i = 0; i < embeddings.length; i++) {
      const centroid = result.centroids[result.clusters[i]];
      for (let j = 0; j < embeddings[i].length; j++) {
        inertia += (embeddings[i][j] - centroid[j]) ** 2;
      }
    }
    inertias.push(inertia);
  }

  // Find elbow: max perpendicular distance from line
  const numPoints = inertias.length;
  if (numPoints <= 1) return minK;
  
  const first = inertias[0];
  const last = inertias[numPoints - 1];
  
  let bestK = minK;
  let maxDist = 0;
  
  for (let i = 0; i < numPoints; i++) {
    const lineY = first + (last - first) * (i / (numPoints - 1));
    const dist = Math.abs(inertias[i] - lineY);
    if (dist > maxDist) {
      maxDist = dist;
      bestK = minK + i;
    }
  }
  
  return bestK;
}
