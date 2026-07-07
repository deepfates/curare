/**
 * Curare — Tests for lore event serialization
 */

import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  CURARE_VIA,
  createJudgmentEvent,
  serializeLoreEvent,
  serializeJudgmentLore,
  uuidv7,
} from '../src/lore.js';

function splitDigestSplice(line: string): { body: string; digest: string } {
  const trimmed = line.endsWith('\n') ? line.slice(0, -1) : line;
  const match = trimmed.match(/,"digest":"(sha256:[0-9a-f]{64})"}$/);
  if (!match?.index) throw new Error('missing digest splice');

  return {
    body: `${trimmed.slice(0, match.index)}}`,
    digest: match[1],
  };
}

describe('lore judgment events', () => {
  it('mints UUIDv7 ids', () => {
    const id = uuidv7(
      new Date('2026-07-06T04:12:31.000Z'),
      Uint8Array.from([0x0d, 0x40, 0x3a, 0xa1, 0x9e, 0x2d, 0x4c, 0x5f, 0x6a, 0x7b])
    );

    expect(id).toBe('019f35a0-af98-7d40-baa1-9e2d4c5f6a7b');
  });

  it('serializes a curare/judgment event with a valid digest splice', () => {
    const event = createJudgmentEvent(
      {
        rating: 'high',
        tag: 'philosophical_inquiry',
        basis: 'openrouter/test-model',
        modelSource: 'response',
        parents: ['item-1', 'item-2'],
      },
      {
        at: new Date('2026-07-06T04:12:31.000Z'),
        id: '0197f3a2-8c1e-7d40-b3a1-9e2d4c5f6a7b',
      }
    );

    const line = serializeLoreEvent(event);
    const { body, digest } = splitDigestSplice(line);
    const parsed = JSON.parse(body);

    expect(line.endsWith('\n')).toBe(true);
    expect(digest).toBe(`sha256:${createHash('sha256').update(body).digest('hex')}`);
    expect(parsed).toEqual({
      v: 1,
      id: '0197f3a2-8c1e-7d40-b3a1-9e2d4c5f6a7b',
      kind: 'curare/judgment',
      at: '2026-07-06T04:12:31.000Z',
      author: {
        actor: 'openrouter/test-model',
        operator: 'deepfates',
        via: CURARE_VIA,
      },
      parents: ['item-1', 'item-2'],
      payload: {
        rating: 'high',
        tag: 'philosophical_inquiry',
        basis: 'openrouter/test-model',
        model_source: 'response',
      },
    });
    expect(parsed).not.toHaveProperty('digest');
  });

  it('writes one lore line per cluster judgment', () => {
    const lore = serializeJudgmentLore(
      [
        { rating: 'high', tag: 'good', basis: 'model/a', modelSource: 'response', parents: ['a'] },
        { rating: 'low', tag: 'thin', basis: 'model/a', modelSource: 'response', parents: ['b', 'c'] },
      ],
      new Date('2026-07-06T04:12:31.000Z')
    );

    const lines = lore.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines.every(line => JSON.parse(splitDigestSplice(`${line}\n`).body).kind === 'curare/judgment')).toBe(true);
  });
});
