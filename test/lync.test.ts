import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseLyncFiles } from '@deepfates/lync/events';
import { createClusterAnnotation, serializeClusterAnnotations } from '../src/lync.js';

function contentLine(id: string, text: string): string {
  const event = {
    v: 1, id, kind: 'corpus/text', at: '2026-07-01T00:00:00.000Z',
    author: { actor: 'alice' }, parents: [], payload: { text },
  };
  const body = JSON.stringify(event);
  return `${body.slice(0, -1)},"digest":"sha256:${createHash('sha256').update(body).digest('hex')}"}\n`;
}

describe('raw lync cluster annotations', () => {
  const parents = [
    '019f7000-0000-7000-8000-000000000001',
    '019f7000-0000-7000-8000-000000000002',
  ];
  const input = {
    clusterId: 2,
    tag: 'agent ecology',
    parents,
    at: '2026-07-01T00:00:00.000Z',
    size: 2,
  };

  it('targets the original ids with a standard deterministic annotation', () => {
    const first = createClusterAnnotation(input);
    const second = createClusterAnnotation({ ...input, parents: [...parents].reverse() });
    expect(first.kind).toBe('lync/annotation');
    expect(first.author).toEqual({ actor: 'curare', via: 'curare@0.1.0' });
    expect(first.parents).toEqual([...parents].sort());
    expect(first.id).toBe(second.id);
    expect(first.payload).toEqual({
      label: 'cluster',
      value: { cluster_id: 2, tag: 'agent ecology', size: 2 },
    });
  });

  it('includes an operator only when explicitly supplied', () => {
    expect(createClusterAnnotation({ ...input, operator: 'lab-operator' }).author)
      .toEqual({ actor: 'curare', via: 'curare@0.1.0', operator: 'lab-operator' });
  });

  it('unions cleanly with its raw targets and is byte-stable on rerun', () => {
    const raw = parents.map((id, index) => contentLine(id, `item ${index}`)).join('');
    const annotations = serializeClusterAnnotations([input]);
    expect(annotations).toBe(serializeClusterAnnotations([input]));
    const parsed = parseLyncFiles([
      { file: 'raw.lync', bytes: raw },
      { file: 'annotations.lync', bytes: annotations },
    ]);
    expect(parsed.lines.every(line => line.class === 'accepted')).toBe(true);
    expect(parsed.viewEligibleIds).toHaveLength(3);
    const annotation = parsed.lines.find(line => line.event?.kind === 'lync/annotation')!.event!;
    expect(annotation.parents).toEqual([...parents].sort());
  });
});
