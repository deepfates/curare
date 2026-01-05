/**
 * Curare — Tests for LLM classification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyWithLLM } from '../src/classify/llm.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('classifyWithLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  it('throws if OPENROUTER_API_KEY is not set', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(classifyWithLLM(['sample'])).rejects.toThrow('OPENROUTER_API_KEY not set');
  });

  it('parses valid JSON response with tag and rating', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: '{"tag": "philosophical inquiry", "rating": "high"}' }
        }]
      })
    });

    const result = await classifyWithLLM(['sample text']);
    
    expect(result.tag).toBe('philosophical inquiry');
    expect(result.rating).toBe('high');
  });

  it('defaults to "unknown" for missing tag', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: '{"rating": "low"}' }
        }]
      })
    });

    const result = await classifyWithLLM(['sample text']);
    
    expect(result.tag).toBe('unknown');
    expect(result.rating).toBe('low');
  });

  it('defaults to "low" for invalid/missing rating', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: '{"tag": "test", "rating": "invalid"}' }
        }]
      })
    });

    const result = await classifyWithLLM(['sample text']);
    
    expect(result.rating).toBe('low');
  });

  it('returns parse_error for invalid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: 'not valid json' }
        }]
      })
    });

    const result = await classifyWithLLM(['sample text']);
    
    expect(result.tag).toBe('parse_error');
    expect(result.rating).toBe('low');
  });

  it('handles API errors in response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: { message: 'Rate limited' }
      })
    });

    const result = await classifyWithLLM(['sample text']);
    
    expect(result.tag).toBe('api_error');
    expect(result.rating).toBe('low');
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error'
    });

    await expect(classifyWithLLM(['sample text'])).rejects.toThrow('OpenRouter error: 500');
  });

  it('uses custom prompt when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"tag": "test", "rating": "high"}' } }]
      })
    });

    await classifyWithLLM(['sample'], { prompt: 'Custom prompt here' });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.messages[0].content).toBe('Custom prompt here');
  });

  it('uses custom model when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"tag": "test", "rating": "high"}' } }]
      })
    });

    await classifyWithLLM(['sample'], { model: 'custom/model' });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe('custom/model');
  });

  it('sends samples numbered in the user message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"tag": "test", "rating": "low"}' } }]
      })
    });

    await classifyWithLLM(['first', 'second', 'third']);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const userContent = callBody.messages[1].content;
    
    expect(userContent).toContain('1. first');
    expect(userContent).toContain('2. second');
    expect(userContent).toContain('3. third');
  });
});
