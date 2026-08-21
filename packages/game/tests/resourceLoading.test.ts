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

  it('keeps parallel directory progress monotonic and includes every in-flight directory', async () => {
    const pending = new Map<string, {
      progress: (finished: number, total: number) => void;
      complete: (error: Error | null) => void;
    }>();
    const values: number[] = [];
    const running = loadRuntimeResourceDirectories((directory, progress, complete) => {
      pending.set(directory, { progress, complete });
    }, (ratio) => values.push(ratio));

    pending.get('game/cats')?.progress(9, 10);
    pending.get('game/backgrounds')?.progress(9, 10);
    pending.get('game/cats')?.complete(null);
    pending.get('game/effects')?.progress(2, 10);

    expect(values.at(-1)).toBeCloseTo(0.525);
    expect(values.every((value, index) => index === 0 || value >= values[index - 1])).toBe(true);

    pending.get('game/backgrounds')?.complete(null);
    pending.get('game/effects')?.complete(null);
    pending.get('game/ui')?.complete(null);
    await running;
    expect(values.at(-1)).toBe(1);
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
