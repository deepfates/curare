/** Target-preserving Curare annotations for raw Lync corpora. */

import { createHash } from 'node:crypto';

export const CURARE_VERSION = '0.1.0';
export const CURARE_VIA = `curare@${CURARE_VERSION}`;

export interface CurareClusterAnnotation {
  clusterId: number;
  tag: string;
  parents: string[];
  at: string;
  size: number;
  rating?: 'high' | 'low';
  basis?: string;
  modelSource?: 'response' | 'request';
  /** Optional human/operator identity. Omitted for unattended Curare output. */
  operator?: string;
}

export interface LyncAnnotationEvent {
  v: 1;
  id: string;
  kind: 'lync/annotation';
  at: string;
  author: { actor: 'curare'; via: string; operator?: string };
  parents: string[];
  payload: {
    label: 'cluster';
    value: {
      cluster_id: number;
      tag: string;
      size: number;
      rating?: 'high' | 'low';
      basis?: string;
      model_source?: 'response' | 'request';
    };
  };
}

function deterministicUuid(seed: string): string {
  const bytes = Uint8Array.from(createHash('sha256').update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createClusterAnnotation(input: CurareClusterAnnotation): LyncAnnotationEvent {
  const parents = [...new Set(input.parents)].sort();
  if (parents.length === 0) throw new Error('cluster annotation requires at least one target');
  const value: LyncAnnotationEvent['payload']['value'] = {
    cluster_id: input.clusterId,
    tag: input.tag,
    size: input.size,
  };
  if (input.rating) value.rating = input.rating;
  if (input.basis) value.basis = input.basis;
  if (input.modelSource) value.model_source = input.modelSource;
  const author: LyncAnnotationEvent['author'] = {
    actor: 'curare',
    via: CURARE_VIA,
  };
  if (input.operator) author.operator = input.operator;
  const core = {
    v: 1 as const,
    kind: 'lync/annotation' as const,
    at: input.at,
    author,
    parents,
    payload: { label: 'cluster' as const, value },
  };
  return { ...core, id: deterministicUuid(JSON.stringify(core)) };
}

export function serializeLyncEvent(event: LyncAnnotationEvent): string {
  const body = JSON.stringify(event);
  const digest = createHash('sha256').update(body).digest('hex');
  return `${body.slice(0, -1)},"digest":"sha256:${digest}"}\n`;
}

export function serializeClusterAnnotations(inputs: CurareClusterAnnotation[]): string {
  return inputs
    .map(createClusterAnnotation)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(serializeLyncEvent)
    .join('');
}
