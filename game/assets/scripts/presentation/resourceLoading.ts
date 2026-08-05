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
  for (let index = 0; index < total; index += 1) {
    await loadResourceDirectory(loader, RUNTIME_RESOURCE_DIRECTORIES[index], (ratio) => {
      onProgress?.((index + ratio) / total);
    });
  }
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
