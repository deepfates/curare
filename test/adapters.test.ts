/**
 * Curare — Tests for input adapters
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { autoLoad, registerAdapter } from '../src/io/adapters.js';
import '../src/io/builtin.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';

function lyncLine(event: Record<string, unknown>): string {
  const body = JSON.stringify(event);
  return `${body.slice(0, -1)},"digest":"sha256:${createHash('sha256').update(body).digest('hex')}"}\n`;
}

describe('input adapters', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curare-test-'));
  });

  it('detects text-jsonl format', async () => {
    const file = path.join(tempDir, 'test.jsonl');
    await fs.writeFile(file, '{"id":"1","text":"hello"}\n{"id":"2","text":"world"}\n');
    
    const { adapter, items } = await autoLoad(file);
    
    expect(adapter).toBe('text-jsonl');
    expect(items).toHaveLength(2);
    expect(items[0].text).toBe('hello');
    expect(items[0].originalLine).toBe('{"id":"1","text":"hello"}');
  });

  it('loads text from raw lync without changing event ids', async () => {
    const file = path.join(tempDir, 'corpus.lync');
    const first = {
      v: 1, id: '019f7000-0000-7000-8000-000000000001', kind: 'corpus/text',
      at: '2026-07-01T00:00:00.000Z', author: { actor: 'alice' }, parents: [],
      payload: { text: 'hello from the raw event' },
    };
    const annotation = {
      v: 1, id: '019f7000-0000-7000-8000-000000000002', kind: 'lync/annotation',
      at: '2026-07-01T00:00:01.000Z', author: { actor: 'curator' }, parents: [first.id],
      payload: { label: 'note', value: 'not cluster material' },
    };
    await fs.writeFile(file, lyncLine(first) + lyncLine(annotation));

    const { adapter, items } = await autoLoad(file);
    expect(adapter).toBe('lync');
    expect(items).toEqual([expect.objectContaining({
      id: first.id,
      text: 'hello from the raw event',
      sourceAt: first.at,
    })]);
  });

  it('loads structured Claude message content without changing the source id', async () => {
    const file = path.join(tempDir, 'claude.lync');
    const event = {
      v: 1, id: '019f7000-0000-7000-8000-000000000003', kind: 'claude/assistant',
      at: '2026-07-01T00:00:02.000Z', author: { actor: 'claude', via: 'claude-code' }, parents: [],
      payload: {
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'structured response' }, { type: 'tool_use', name: 'read' }],
        },
      },
    };
    await fs.writeFile(file, lyncLine(event));

    const { adapter, items } = await autoLoad(file);
    expect(adapter).toBe('lync');
    expect(items).toEqual([expect.objectContaining({
      id: event.id,
      text: 'structured response',
      sourceAt: event.at,
    })]);
  });

  it('canonicalizes raw lync items across line order, annotations, and duplicates', async () => {
    const ids = [
      '019f7000-0000-7000-8000-000000000013',
      '019f7000-0000-7000-8000-000000000011',
      '019f7000-0000-7000-8000-000000000012',
    ];
    const events = ids.map((id, index) => ({
      v: 1,
      id,
      kind: 'corpus/text',
      at: `2026-07-01T00:00:1${index}.000Z`,
      author: { actor: 'alice' },
      parents: [],
      payload: { text: `item ${id.slice(-2)}` },
    }));
    const annotation = {
      v: 1,
      id: '019f7000-0000-7000-8000-000000000014',
      kind: 'lync/annotation',
      at: '2026-07-01T00:00:14.000Z',
      author: { actor: 'curator' },
      parents: [ids[0]],
      payload: { label: 'note', text: 'not cluster material' },
    };
    const first = path.join(tempDir, 'ordered-a.lync');
    const second = path.join(tempDir, 'ordered-b.lync');
    await fs.writeFile(
      first,
      lyncLine(events[0])
        + lyncLine(annotation)
        + lyncLine(events[1])
        + lyncLine(events[2])
        + lyncLine(events[0]),
    );
    await fs.writeFile(
      second,
      lyncLine(events[2]) + lyncLine(events[0]) + lyncLine(annotation) + lyncLine(events[1]),
    );

    const [loadedFirst, loadedSecond] = await Promise.all([autoLoad(first), autoLoad(second)]);
    expect(loadedFirst.adapter).toBe('lync');
    expect(loadedFirst.items.map(item => item.id)).toEqual([...ids].sort());
    expect(loadedFirst.items).toEqual(loadedSecond.items);
  });

  it('enumerates opaque lync ids by UTF-8 bytes instead of host locale collation', async () => {
    const ids = ['ä', 'z', 'a', 'A'];
    const file = path.join(tempDir, 'opaque-ids.lync');
    const raw = ids.map((id, index) => lyncLine({
      v: 1,
      id,
      kind: 'corpus/text',
      at: `2026-07-01T00:01:0${index}.000Z`,
      author: { actor: 'alice' },
      parents: [],
      payload: { text: `item ${id}` },
    })).join('');
    await fs.writeFile(file, raw);

    const loaded = await autoLoad(file);

    expect(loaded.items.map(item => item.id)).toEqual(['A', 'a', 'z', 'ä']);
  });

  it('refuses a damaged lync line instead of silently dropping it', async () => {
    const file = path.join(tempDir, 'damaged.lync');
    await fs.writeFile(file, '{"v":1,"id":"x","kind":"corpus/text","at":"2026-07-01T00:00:00Z","author":{"actor":"a"},"parents":[],"payload":{"text":"x"},"digest":"sha256:deadbeef"}\n');
    await expect(autoLoad(file)).rejects.toThrow('Refusing damaged or conflicted .lync input');
  });

  it('detects alpaca format', async () => {
    const file = path.join(tempDir, 'alpaca.jsonl');
    await fs.writeFile(file, '{"instruction":"Do X","input":"with Y","output":"result Z"}\n');
    
    const { adapter, items } = await autoLoad(file);
    
    expect(adapter).toBe('alpaca');
    expect(items[0].text).toContain('Do X');
    expect(items[0].text).toContain('result Z');
    expect(items[0].originalLine).toBe('{"instruction":"Do X","input":"with Y","output":"result Z"}');
  });

  it('preserves original line for ShareGPT format', async () => {
    const file = path.join(tempDir, 'sharegpt.jsonl');
    const line = '{"id":"c1","conversations":[{"from":"human","value":"hi"},{"from":"gpt","value":"hello"}]}';
    await fs.writeFile(file, `${line}\n`);

    const { adapter, items } = await autoLoad(file);

    expect(adapter).toBe('sharegpt');
    expect(items).toHaveLength(1);
    expect(items[0].originalLine).toBe(line);
  });

  it('detects folder format', async () => {
    const folder = path.join(tempDir, 'notes');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'note1.md'), '# Hello');
    await fs.writeFile(path.join(folder, 'note2.txt'), 'World');
    
    const { adapter, items } = await autoLoad(folder);
    
    expect(adapter).toBe('folder');
    expect(items).toHaveLength(2);
  });

  it('allows custom adapter registration', async () => {
    registerAdapter({
      name: 'custom',
      async detect(_input, firstLine) {
        return firstLine?.includes('CUSTOM:') ?? false;
      },
      async *load(input) {
        const content = await fs.readFile(input, 'utf8');
        yield { id: '1', text: content.replace('CUSTOM:', '') };
      },
    });

    const file = path.join(tempDir, 'custom.txt');
    await fs.writeFile(file, 'CUSTOM:my data');
    
    const { adapter, items } = await autoLoad(file);
    
    expect(adapter).toBe('custom');
    expect(items[0].text).toBe('my data');
  });
});
