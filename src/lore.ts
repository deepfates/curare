/**
 * Curare — Lore event emission
 */

import { createHash, randomBytes } from 'node:crypto';

export const CURARE_VERSION = '0.1.0';
export const CURARE_VIA = `curare@${CURARE_VERSION}`;

export interface CurareJudgment {
  rating: 'high' | 'low';
  tag: string;
  basis: string;
  modelSource: 'response' | 'request';
  parents: string[];
}

export interface LoreEvent {
  v: 1;
  id: string;
  kind: string;
  at: string;
  author: {
    actor: string;
    operator: string;
    via: string;
  };
  parents: string[];
  payload: {
    rating: 'high' | 'low';
    tag: string;
    basis: string;
    model_source: 'response' | 'request';
  };
}

export function uuidv7(date: Date = new Date(), random = randomBytes(10)): string {
  if (random.length !== 10) {
    throw new Error('uuidv7 requires exactly 10 random bytes');
  }

  const bytes = new Uint8Array(16);
  let timestamp = BigInt(date.getTime());
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }

  bytes[6] = 0x70 | (random[0] & 0x0f);
  bytes[7] = random[1];
  bytes[8] = 0x80 | (random[2] & 0x3f);
  bytes[9] = random[3];
  bytes[10] = random[4];
  bytes[11] = random[5];
  bytes[12] = random[6];
  bytes[13] = random[7];
  bytes[14] = random[8];
  bytes[15] = random[9];

  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createJudgmentEvent(
  judgment: CurareJudgment,
  options: {
    at?: Date;
    id?: string;
  } = {}
): LoreEvent {
  return {
    v: 1,
    id: options.id ?? uuidv7(options.at),
    kind: 'curare/judgment',
    at: (options.at ?? new Date()).toISOString(),
    author: {
      actor: judgment.basis,
      operator: 'deepfates',
      via: CURARE_VIA,
    },
    parents: judgment.parents,
    payload: {
      rating: judgment.rating,
      tag: judgment.tag,
      basis: judgment.basis,
      model_source: judgment.modelSource,
    },
  };
}

export function serializeLoreEvent(event: LoreEvent): string {
  const body = JSON.stringify(event);
  const digest = createHash('sha256').update(body).digest('hex');
  return `${body.slice(0, -1)},"digest":"sha256:${digest}"}\n`;
}

export function serializeJudgmentLore(judgments: CurareJudgment[], at: Date = new Date()): string {
  return judgments
    .map(judgment => serializeLoreEvent(createJudgmentEvent(judgment, { at })))
    .join('');
}
