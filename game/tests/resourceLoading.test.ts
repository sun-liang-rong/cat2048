import { describe, expect, it, vi } from 'vitest';
import { loadResourceDirectory } from '../assets/scripts/presentation/resourceLoading';

describe('loadResourceDirectory', () => {
  it('reports normalized progress and resolves after the directory loads', async () => {
    const onProgress = vi.fn();

    await loadResourceDirectory((_directory, progress, complete) => {
      progress(2, 4);
      complete(null);
    }, 'game', onProgress);

    expect(onProgress).toHaveBeenNthCalledWith(1, 0.5);
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it('rejects when the directory loader fails', async () => {
    const error = new Error('subpackage unavailable');

    await expect(loadResourceDirectory((_directory, _progress, complete) => {
      complete(error);
    }, 'game')).rejects.toBe(error);
  });
});
