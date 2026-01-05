/**
 * Curare — Tests for classification module
 */

import { describe, it, expect } from 'vitest';
import { classifyHeuristic } from '../src/classify/heuristic.js';

describe('classifyHeuristic', () => {
  it('returns empty/low for empty input', () => {
    const result = classifyHeuristic([]);
    expect(result.tag).toBe('empty');
    expect(result.rating).toBe('low');
  });

  it('rates short content as low', () => {
    const result = classifyHeuristic(['hi', 'hello', 'ok']);
    expect(result.rating).toBe('low');
  });

  it('rates diverse substantive content as high', () => {
    const result = classifyHeuristic([
      'This is a comprehensive analysis of machine learning algorithms and their applications in modern software engineering practices.',
      'Understanding the fundamental principles of distributed systems requires deep knowledge of networking protocols and consensus mechanisms.',
      'The intersection of cognitive science and artificial intelligence reveals fascinating insights about human reasoning and computational thinking.',
    ]);
    expect(result.rating).toBe('high');
  });

  it('generates tag from common words', () => {
    const result = classifyHeuristic([
      'Programming programming programming code',
      'More programming and code examples',
    ]);
    expect(result.tag).toContain('programming');
  });
});
