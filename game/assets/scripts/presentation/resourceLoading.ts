export type ResourceDirectoryLoader = (
  directory: string,
  onProgress: (finished: number, total: number) => void,
  onComplete: (error: Error | null) => void,
) => void;

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
