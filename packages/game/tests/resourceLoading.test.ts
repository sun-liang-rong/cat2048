import { describe, expect, it, vi } from 'vitest';
import {
  loadResourceDirectory,
  loadRuntimeResourceDirectories,
  RUNTIME_RESOURCE_DIRECTORIES,
} from '../assets/scripts/ui/utils/resourceLoading';

describe('loadResourceDirectory', () => {
  it('preloads runtime directories without the unused bitmap-font source', () => {
    expect(RUNTIME_RESOURCE_DIRECTORIES).toEqual([
      'game/cats',
      'game/backgrounds',
      'game/effects',
      'game/ui',
    ]);
  });

  it('aggregates progress across the runtime directories', async () => {
    const loadedDirectories: string[] = [];
    const onProgress = vi.fn();

    await loadRuntimeResourceDirectories((directory, progress, complete) => {
      loadedDirectories.push(directory);
      progress(1, 1);
      complete(null);
    }, onProgress);

    expect(loadedDirectories).toEqual([...RUNTIME_RESOURCE_DIRECTORIES]);
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

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
