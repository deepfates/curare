/**
 * Curare — Input adapter types and registry
 */

export interface InputItem {
  id: string;
  text: string;
  /** Original line from input file, for format preservation */
  originalLine?: string;
}

export interface InputAdapter {
  name: string;
  /** Check if this adapter can handle the input (file path or first line of file) */
  detect(input: string, firstLine?: string): Promise<boolean>;
  /** Load items from input path */
  load(input: string): AsyncIterable<InputItem>;
}

const adapters: InputAdapter[] = [];

/** Register a custom input adapter */
export function registerAdapter(adapter: InputAdapter): void {
  adapters.unshift(adapter); // Custom adapters take priority
}

/** Get all registered adapters */
export function getAdapters(): InputAdapter[] {
  return [...adapters];
}

/** Detect and load using the first matching adapter */
export async function autoLoad(input: string): Promise<{ adapter: string; items: InputItem[] }> {
  const fs = await import('node:fs/promises');
  const stat = await fs.stat(input).catch(() => null);
  
  let firstLine: string | undefined;
  if (stat?.isFile()) {
    const content = await fs.readFile(input, 'utf8');
    firstLine = content.split('\n')[0];
  }

  for (const adapter of adapters) {
    if (await adapter.detect(input, firstLine)) {
      const items: InputItem[] = [];
      for await (const item of adapter.load(input)) {
        items.push(item);
      }
      return { adapter: adapter.name, items };
    }
  }

  throw new Error(`No adapter found for input: ${input}`);
}
