/**
 * Curare — Offline cluster tagging
 */

export interface ClusterClassification {
  tag: string;
  rating: 'high' | 'low';
  basis?: string;
}
export interface ClusterTag {
  tag: string;
}

function wordsFor(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) ?? [];
}

function normalizeSample(text: string): string {
  return wordsFor(text).join(' ');
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }

  return intersection / (a.size + b.size - intersection);
}

function dedupeSamples(samples: string[]): string[] {
  const kept: Array<{ text: string; normalized: string; wordSet: Set<string> }> = [];

  for (const text of samples) {
    const normalized = normalizeSample(text);
    if (!normalized) continue;

    const wordSet = new Set(normalized.split(' '));
    const isDuplicate = kept.some(sample =>
      sample.normalized === normalized || jaccardSimilarity(sample.wordSet, wordSet) >= 0.9
    );

    if (!isDuplicate) {
      kept.push({ text, normalized, wordSet });
    }
  }

  return kept.map(sample => sample.text);
}

function getTagWords(samples: string[]): string[] {
  const deduped = dedupeSamples(samples);
  return deduped.flatMap(wordsFor);
}

/**
 * Generate a rough cluster tag without attempting a quality judgment.
 */
export function classifyHeuristic(samples: string[]): ClusterTag {
  if (samples.length === 0) {
    return { tag: 'empty' };
  }

  const words = getTagWords(samples);

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

  return { tag };
}
