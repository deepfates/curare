/**
 * Curare — Cluster classification (heuristic)
 */

export interface ClusterClassification {
  tag: string;
  rating: 'high' | 'low';
}

/**
 * Classify a cluster using simple heuristics:
 * - Word diversity (unique words / total words)
 * - Average text length
 * - Vocabulary sophistication (long words ratio)
 */
export function classifyHeuristic(samples: string[]): ClusterClassification {
  if (samples.length === 0) {
    return { tag: 'empty', rating: 'low' };
  }

  const allText = samples.join(' ');
  const words = allText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words);
  
  // Metrics
  const diversity = words.length > 0 ? uniqueWords.size / words.length : 0;
  const avgLength = samples.reduce((s, t) => s + t.length, 0) / samples.length;
  const longWords = words.filter(w => w.length > 6).length;
  const sophistication = words.length > 0 ? longWords / words.length : 0;

  // Generate tag from most common long words
  const wordCounts = new Map<string, number>();
  for (const w of words) {
    if (w.length > 4) {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
  }
  const topWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);
  
  const tag = topWords.length > 0 ? topWords.join('_') : 'misc';

  // Rating based on quality signals
  const isHighQuality = 
    diversity > 0.3 &&      // Not too repetitive
    avgLength > 100 &&      // Substantive content
    sophistication > 0.15;  // Some vocabulary depth

  return {
    tag,
    rating: isHighQuality ? 'high' : 'low',
  };
}
