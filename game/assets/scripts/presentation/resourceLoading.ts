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
  let completed = 0;
  // 目录之间无依赖，并行加载能显著缩短启动耗时。
  await Promise.all(RUNTIME_RESOURCE_DIRECTORIES.map((directory) =>
    loadResourceDirectory(loader, directory, (ratio) => {
      onProgress?.((completed + ratio) / total);
    }).then(() => {
      completed += 1;
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
