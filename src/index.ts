/**
 * Curare — Library exports
 * 
 * A small, sharp tool for butchering your data.
 */

// Input adapters
export { registerAdapter, autoLoad, getAdapters, type InputAdapter, type InputItem } from './io/adapters.js';
import './io/builtin.js'; // Register built-in adapters

// Embeddings
export { getTextEmbeddings, type EmbedOptions, type EmbedItem } from './embed/text.js';
export { EmbeddingCache } from './io/cache.js';

// Clustering
export { clusterEmbeddings, findOptimalK, getNearestToCentroid, type ClusterResult } from './cluster/kmeans.js';

// Classification
export { classifyHeuristic, type ClusterClassification } from './classify/heuristic.js';
export { classifyWithLLM } from './classify/llm.js';
