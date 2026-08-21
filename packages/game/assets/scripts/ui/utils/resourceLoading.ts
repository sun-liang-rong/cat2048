export type ResourceDirectoryLoader = (
  directory: string,
  onProgress: (finished: number, total: number) => void,
  onComplete: (error: Error | null) => void,
) => void;

// The generated BMFont source is not needed at runtime and is not part of the remote asset set.
export const RUNTIME_RESOURCE_DIRECTORIES = [
  'game/cats',
  'game/backgrounds',
  'game/effects',
  'game/ui',
] as const;

export async function loadRuntimeResourceDirectories(loader: ResourceDirectoryLoader,
  onProgress?: (ratio: number) => void): Promise<void> {
  const total = RUNTIME_RESOURCE_DIRECTORIES.length;
  const directoryProgress = new Map<string, number>(
    RUNTIME_RESOURCE_DIRECTORIES.map((directory) => [directory, 0]),
  );
  const report = (directory: string, ratio: number): void => {
    const normalized = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
    const previous = directoryProgress.get(directory) ?? 0;
    directoryProgress.set(directory, Math.max(previous, normalized));
    const aggregate = Array.from(directoryProgress.values()).reduce((sum, value) => sum + value, 0);
    onProgress?.(aggregate / total);
  };
  // 目录之间无依赖，并行加载能显著缩短启动耗时。
  await Promise.all(RUNTIME_RESOURCE_DIRECTORIES.map((directory) =>
    loadResourceDirectory(loader, directory, (ratio) => {
      report(directory, ratio);
    }),
  ));
  onProgress?.(1);
}

export function loadResourceDirectory(loader: ResourceDirectoryLoader, directory: string,
  onProgress?: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    loader(directory, (finished, total) => {
      onProgress?.(total > 0 ? finished / total : 0);
    }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      onProgress?.(1);
      resolve();
    });
  });
}
