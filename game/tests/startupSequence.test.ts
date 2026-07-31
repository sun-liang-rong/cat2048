import { describe, expect, it, vi } from 'vitest';
import { runStartupSequence } from '../assets/scripts/presentation/startupSequence';

describe('runStartupSequence', () => {
  it('keeps home hidden until preload resolves', async () => {
    let resolvePreload!: () => void;
    const preload = new Promise<void>((resolve) => { resolvePreload = resolve; });
    const onReady = vi.fn();
    const running = runStartupSequence({
      preload: () => preload,
      isActive: () => true,
      onReady,
      onError: vi.fn(),
    });

    expect(onReady).not.toHaveBeenCalled();
    resolvePreload();
    await running;

    expect(onReady).toHaveBeenCalledOnce();
  });

  it('reports preload failures without showing home', async () => {
    const error = new Error('asset load failed');
    const onReady = vi.fn();
    const onError = vi.fn();

    await runStartupSequence({
      preload: () => Promise.reject(error),
      isActive: () => true,
      onReady,
      onError,
    });

    expect(onReady).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
