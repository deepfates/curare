/**
 * Curare — Built-in input adapters
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { registerAdapter, type InputItem } from './adapters.js';

/** Alpaca format: {instruction, input?, output} */
registerAdapter({
  name: 'alpaca',
  async detect(_input: string, firstLine?: string) {
    if (!firstLine) return false;
    try {
      const obj = JSON.parse(firstLine);
      return 'instruction' in obj && 'output' in obj;
    } catch { return false; }
  },
  async *load(input: string): AsyncIterable<InputItem> {
    const content = await fs.readFile(input, 'utf8');
    let idx = 0;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const text = [obj.instruction, obj.input, obj.output].filter(Boolean).join('\n\n');
        yield { id: obj.id ?? String(idx++), text };
      } catch { /* skip */ }
    }
  }
});

/** ShareGPT format: {conversations: [{from, value}]} */
registerAdapter({
  name: 'sharegpt',
  async detect(_input: string, firstLine?: string) {
    if (!firstLine) return false;
    try {
      const obj = JSON.parse(firstLine);
      return Array.isArray(obj.conversations) && obj.conversations[0]?.value !== undefined;
    } catch { return false; }
  },
  async *load(input: string): AsyncIterable<InputItem> {
    const content = await fs.readFile(input, 'utf8');
    let idx = 0;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const text = obj.conversations.map((c: { value: string }) => c.value).join('\n\n');
        yield { id: obj.id ?? String(idx++), text };
      } catch { /* skip */ }
    }
  }
});

/** OAI Messages format: {messages: [{role, content}]} — extracts assistant content for embedding */
registerAdapter({
  name: 'oai',
  async detect(_input: string, firstLine?: string) {
    if (!firstLine) return false;
    try {
      const obj = JSON.parse(firstLine);
      return Array.isArray(obj.messages) && obj.messages[0]?.content !== undefined;
    } catch { return false; }
  },
  async *load(input: string): AsyncIterable<InputItem> {
    const content = await fs.readFile(input, 'utf8');
    let idx = 0;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        // For training data, embed only assistant responses (what model learns to generate)
        // Skip system prompts (same across all) and optionally include user for context
        const assistantMsgs = obj.messages
          .filter((m: { role: string }) => m.role === 'assistant')
          .map((m: { content: string }) => m.content);
        
        if (assistantMsgs.length > 0) {
          const text = assistantMsgs.join('\n\n');
          yield { id: obj.id ?? String(idx++), text, originalLine: line };
        }
      } catch { /* skip */ }
    }
  }
});

/** Splice/generic format: {id?, text} */
registerAdapter({
  name: 'text-jsonl',
  async detect(_input: string, firstLine?: string) {
    if (!firstLine) return false;
    try {
      const obj = JSON.parse(firstLine);
      return typeof obj.text === 'string';
    } catch { return false; }
  },
  async *load(input: string): AsyncIterable<InputItem> {
    const content = await fs.readFile(input, 'utf8');
    let idx = 0;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.text) {
          yield { id: obj.id ?? String(idx++), text: obj.text };
        }
      } catch { /* skip */ }
    }
  }
});

/** Folder of text files (.txt, .md) — works with Obsidian vaults */
registerAdapter({
  name: 'folder',
  async detect(input: string) {
    try {
      const stat = await fs.stat(input);
      return stat.isDirectory();
    } catch { return false; }
  },
  async *load(input: string): AsyncIterable<InputItem> {
    const entries = await fs.readdir(input, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.txt', '.md', '.markdown'].includes(ext)) continue;
      
      const filePath = path.join(input, entry.name);
      const content = await fs.readFile(filePath, 'utf8');
      if (content.trim()) {
        yield { id: entry.name, text: content };
      }
    }
  }
});
