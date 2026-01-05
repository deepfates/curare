/**
 * Curare — Tests for input adapters
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { autoLoad, registerAdapter } from '../src/io/adapters.js';
import '../src/io/builtin.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

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
  });

  it('detects alpaca format', async () => {
    const file = path.join(tempDir, 'alpaca.jsonl');
    await fs.writeFile(file, '{"instruction":"Do X","input":"with Y","output":"result Z"}\n');
    
    const { adapter, items } = await autoLoad(file);
    
    expect(adapter).toBe('alpaca');
    expect(items[0].text).toContain('Do X');
    expect(items[0].text).toContain('result Z');
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
