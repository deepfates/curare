/**
 * Curare — Tests for embedding module behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const pipelineMock = vi.fn();
vi.mock('@xenova/transformers', () => ({
  pipeline: pipelineMock,
}));

describe('getTextEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses extractor per model and initializes a new one for a different model', async () => {
    vi.resetModules();

    const extractorByModel = new Map<string, ReturnType<typeof vi.fn>>();
    pipelineMock.mockImplementation(async (_task: string, model: string) => {
      if (!extractorByModel.has(model)) {
        extractorByModel.set(
          model,
          vi.fn(async (text: string) => ({
            data: Float32Array.from([model.length, text.length]),
          }))
        );
      }
      return extractorByModel.get(model);
    });

    const { getTextEmbeddings } = await import('../src/embed/text.js');

    await getTextEmbeddings([{ id: '1', text: 'hello' }], { model: 'model/a' });
    await getTextEmbeddings([{ id: '2', text: 'world' }], { model: 'model/a' });
    await getTextEmbeddings([{ id: '3', text: 'again' }], { model: 'model/b' });

    expect(pipelineMock).toHaveBeenCalledTimes(2);
    expect(pipelineMock).toHaveBeenNthCalledWith(1, 'feature-extraction', 'model/a');
    expect(pipelineMock).toHaveBeenNthCalledWith(2, 'feature-extraction', 'model/b');

    expect(extractorByModel.get('model/a')).toHaveBeenCalledTimes(2);
    expect(extractorByModel.get('model/b')).toHaveBeenCalledTimes(1);
  });
});
