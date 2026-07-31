export interface StartupSequenceOptions {
  preload(): Promise<void>;
  isActive(): boolean;
  onReady(): void;
  onError(error: unknown): void;
}

export async function runStartupSequence(options: StartupSequenceOptions): Promise<void> {
  try {
    await options.preload();
    if (options.isActive()) options.onReady();
  } catch (error) {
    if (options.isActive()) options.onError(error);
  }
}
