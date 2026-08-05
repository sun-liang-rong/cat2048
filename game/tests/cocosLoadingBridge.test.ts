import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  markCocosLoadingError,
  markCocosLoadingReady,
  reportCocosLoadingProgress,
} from '../assets/scripts/presentation/cocosLoadingBridge';

type LoadingBridge = {
  setProgress: ReturnType<typeof vi.fn>;
  markReady: ReturnType<typeof vi.fn>;
  markError: ReturnType<typeof vi.fn>;
};

const runtime = globalThis as typeof globalThis & { __cat2048CocosLoading?: LoadingBridge };

afterEach(() => {
  delete runtime.__cat2048CocosLoading;
});

describe('cocosLoadingBridge', () => {
  it('clamps and forwards runtime asset progress', () => {
    const bridge: LoadingBridge = {
      setProgress: vi.fn(),
      markReady: vi.fn(),
      markError: vi.fn(),
    };
    runtime.__cat2048CocosLoading = bridge;

    reportCocosLoadingProgress(-1);
    reportCocosLoadingProgress(0.42);
    reportCocosLoadingProgress(2);

    expect(bridge.setProgress).toHaveBeenNthCalledWith(1, 0);
    expect(bridge.setProgress).toHaveBeenNthCalledWith(2, 0.42);
    expect(bridge.setProgress).toHaveBeenNthCalledWith(3, 1);
  });

  it('forwards ready and error lifecycle events', () => {
    const bridge: LoadingBridge = {
      setProgress: vi.fn(),
      markReady: vi.fn(),
      markError: vi.fn(),
    };
    const error = new Error('resource failure');
    runtime.__cat2048CocosLoading = bridge;

    markCocosLoadingReady();
    markCocosLoadingError(error);

    expect(bridge.markReady).toHaveBeenCalledOnce();
    expect(bridge.markError).toHaveBeenCalledWith(error);
  });

  it('is a no-op when the Cocos bridge is not present', () => {
    expect(() => {
      reportCocosLoadingProgress(0.5);
      markCocosLoadingReady();
      markCocosLoadingError(new Error('preview failure'));
    }).not.toThrow();
  });
});
