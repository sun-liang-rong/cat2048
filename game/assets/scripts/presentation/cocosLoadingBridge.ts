export interface CocosLoadingBridge {
  setProgress?: (ratio: number) => void;
  markReady?: () => void;
  markError?: (error: unknown) => void;
}

type CocosLoadingRuntime = typeof globalThis & {
  __cat2048CocosLoading?: CocosLoadingBridge;
};

const getBridge = (): CocosLoadingBridge | undefined => (
  (globalThis as CocosLoadingRuntime).__cat2048CocosLoading
);

export function reportCocosLoadingProgress(ratio: number): void {
  const normalized = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  getBridge()?.setProgress?.(normalized);
}

export function markCocosLoadingReady(): void {
  getBridge()?.markReady?.();
}

export function markCocosLoadingError(error: unknown): void {
  getBridge()?.markError?.(error);
}
