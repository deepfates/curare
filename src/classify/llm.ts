/**
 * Curare — Cluster classification via LLM (OpenRouter)
 */

import type { ClusterClassification } from './heuristic.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

const DEFAULT_PROMPT = `You are a data curator. Classify this cluster of text samples.

Respond with JSON: {"tag": "short descriptive label", "rating": "high" or "low"}

Rating criteria:
- HIGH: Original thought, substantive discussion, interesting perspectives
- LOW: Short/simple messages, repetitive content, low information density

Samples:`;

/**
 * Classify a cluster using an LLM via OpenRouter.
 */
export async function classifyWithLLM(
  samples: string[],
  options: {
    prompt?: string;
    model?: string;
    apiKey?: string;
    verbose?: boolean;
  } = {}
): Promise<ClusterClassification> {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const model = options.model ?? DEFAULT_MODEL;
  const prompt = options.prompt ?? DEFAULT_PROMPT;
  const content = samples.map((s, i) => `${i + 1}. ${s}`).join('\n\n');

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (options.verbose) console.error('OpenRouter error:', errorText);
    throw new Error(`OpenRouter error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    error?: { message: string };
  };
  
  if (options.verbose) console.error('LLM response:', JSON.stringify(json, null, 2));
  
  // Check for API error in response body
  if (json.error) {
    if (options.verbose) console.error('API error:', json.error.message);
    return { tag: 'api_error', rating: 'low' };
  }
  
  const text = json.choices?.[0]?.message?.content ?? '{}';
  
  try {
    const parsed = JSON.parse(text) as { tag?: string; rating?: string };
    return {
      tag: parsed.tag ?? 'unknown',
      rating: parsed.rating === 'high' ? 'high' : 'low',
    };
  } catch {
    if (options.verbose) console.error('Parse error, raw text:', text);
    return { tag: 'parse_error', rating: 'low' };
  }
}
