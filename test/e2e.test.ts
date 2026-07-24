/**
 * Curare — E2E integration test
 * 
 * Tests the full pipeline: input → embed → cluster → classify → output
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('E2E Pipeline', () => {
  let tempDir: string;
  let inputFile: string;
  let outputFile: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'curare-e2e-'));
    inputFile = path.join(tempDir, 'input.jsonl');
    outputFile = path.join(tempDir, 'output.json');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true });
  });

  it('advertises raw Lync input in CLI help', () => {
    const result = spawnSync('npx', ['tsx', 'src/cli.ts', '--help'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('corpus.lync');
    expect(result.stdout).toContain('Auto-detects: Lync');
  });

  it('processes JSONL through full pipeline in offline clusters-only mode', async () => {
    // Create test input with distinct clusters
    const items = [
      // Cluster 1: Short simple
      { id: '1', text: 'hello' },
      { id: '2', text: 'hi there' },
      { id: '3', text: 'hey' },
      // Cluster 2: Longer substantive
      { id: '4', text: 'The intersection of machine learning and cognitive science reveals fascinating insights about both artificial and human intelligence systems.' },
      { id: '5', text: 'Understanding distributed systems requires deep knowledge of networking protocols, consensus mechanisms, and fault tolerance strategies.' },
      { id: '6', text: 'Philosophical inquiries into consciousness and subjective experience remain some of the most challenging problems in modern science.' },
    ];
    
    await fs.writeFile(inputFile, items.map(i => JSON.stringify(i)).join('\n'));

    // Run CLI
    const cwd = path.resolve(import.meta.dirname, '..');
    execSync(`npx tsx src/cli.ts ${inputFile} -k 2 -o ${outputFile}`, { 
      cwd, 
      stdio: 'pipe',
      env: { ...process.env, OPENROUTER_API_KEY: '' },
    });

    // Verify output
    const output = JSON.parse(await fs.readFile(outputFile, 'utf8'));
    
    expect(output.k).toBe(2);
    expect(output.clusters).toHaveLength(2);
    
    // Each cluster should have items
    for (const cluster of output.clusters) {
      expect(cluster.items.length).toBeGreaterThan(0);
      expect(cluster.tag).toBeDefined();
      expect(cluster).not.toHaveProperty('rating');
      expect(cluster.samples.length).toBeGreaterThan(0);
    }

    // Total items should equal input
    const totalItems = output.clusters.reduce((sum: number, c: { size: number }) => sum + c.size, 0);
    expect(totalItems).toBe(items.length);
  });

  it('processes folder of markdown files', async () => {
    const folderPath = path.join(tempDir, 'notes');
    await fs.mkdir(folderPath, { recursive: true });
    
    await fs.writeFile(path.join(folderPath, 'note1.md'), '# AI Research\n\nMachine learning and neural networks are transforming how we approach complex problems.');
    await fs.writeFile(path.join(folderPath, 'note2.md'), '# Philosophy\n\nConsciousness and free will remain deeply debated topics in philosophy of mind.');
    await fs.writeFile(path.join(folderPath, 'note3.md'), '# Simple Note\n\nHello world.');

    const folderOutput = path.join(tempDir, 'folder-output.json');
    const cwd = path.resolve(import.meta.dirname, '..');
    
    execSync(`npx tsx src/cli.ts ${folderPath} -k 2 -o ${folderOutput}`, {
      cwd,
      stdio: 'pipe',
      env: { ...process.env, OPENROUTER_API_KEY: '' },
    });

    const output = JSON.parse(await fs.readFile(folderOutput, 'utf8'));
    
    expect(output.clusters).toHaveLength(2);
    expect(output.source).toBe('notes');
  });

  it('auto-detects OAI format', async () => {
    const oaiFile = path.join(tempDir, 'oai.jsonl');
    const items = [
      { messages: [{ role: 'system', content: 'You are helpful' }, { role: 'assistant', content: 'Hello, how can I help?' }] },
      { messages: [{ role: 'system', content: 'You are helpful' }, { role: 'assistant', content: 'Sure, I can explain that concept.' }] },
      { messages: [{ role: 'system', content: 'You are helpful' }, { role: 'assistant', content: 'Great question about neural networks!' }] },
    ];
    
    await fs.writeFile(oaiFile, items.map(i => JSON.stringify(i)).join('\n'));

    const oaiOutput = path.join(tempDir, 'oai-output.json');
    const cwd = path.resolve(import.meta.dirname, '..');
    
    execSync(`npx tsx src/cli.ts ${oaiFile} -k 2 -o ${oaiOutput}`, {
      cwd,
      stdio: 'pipe',
      env: { ...process.env, OPENROUTER_API_KEY: '' },
    });

    const output = JSON.parse(await fs.readFile(oaiOutput, 'utf8'));
    
    // Should have processed all items (only assistant content extracted)
    const totalItems = output.clusters.reduce((sum: number, c: { size: number }) => sum + c.size, 0);
    expect(totalItems).toBe(3);
  });

  it('writes clusters only and refuses quality rating for the adversarial offline fixture', async () => {
    const cwd = path.resolve(import.meta.dirname, '..');
    const fixture = path.join(cwd, 'test/fixtures/offline-adversarial-refusal.jsonl');
    const outDir = path.join(tempDir, 'offline-adversarial-out');

    const result = spawnSync(
      'npx',
      ['tsx', 'src/cli.ts', fixture, '--no-llm', '-k', '2', '--samples', '4', '-d', outDir],
      {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, OPENROUTER_API_KEY: '' },
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('quality rating requires a judge — set OPENROUTER_API_KEY or pass --classify-llm');
    expect(result.stdout).toContain('no high/low split');

    const clustersPath = path.join(outDir, 'clusters.json');
    const output = JSON.parse(await fs.readFile(clustersPath, 'utf8'));
    expect(output.clusters).toHaveLength(2);
    expect(output.clusters.every((cluster: Record<string, unknown>) => typeof cluster.tag === 'string')).toBe(true);
    expect(output.clusters.every((cluster: Record<string, unknown>) => !('rating' in cluster))).toBe(true);

    expect(await exists(path.join(outDir, 'high.jsonl'))).toBe(false);
    expect(await exists(path.join(outDir, 'low.jsonl'))).toBe(false);
  });
}, { timeout: 120000 }); // Allow time for model loading
