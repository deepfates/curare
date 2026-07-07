/**
 * Curare — Tests for classification module
 */

import { describe, it, expect } from 'vitest';
import { classifyHeuristic } from '../src/classify/heuristic.js';

describe('classifyHeuristic', () => {
  it('returns empty tag for empty input', () => {
    const result = classifyHeuristic([]);
    expect(result.tag).toBe('empty');
    expect(result).not.toHaveProperty('rating');
  });

  it('does not rate short content', () => {
    const result = classifyHeuristic(['hi', 'hello', 'ok']);
    expect(result).not.toHaveProperty('rating');
  });

  it('generates tag from common words', () => {
    const result = classifyHeuristic([
      'Programming programming programming code',
      'More programming and code examples',
    ]);
    expect(result.tag).toContain('programming');
  });
});
