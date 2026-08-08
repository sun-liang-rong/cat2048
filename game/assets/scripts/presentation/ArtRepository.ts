import { AudioClip, Font, ImageAsset, resources, SpriteFrame, Texture2D, TTFFont } from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import { allCosmetics } from '../economy/catalog';
import { loadRuntimeResourceDirectories } from './resourceLoading';

export class ArtRepository {
  private readonly frames = new Map<string, SpriteFrame>();
  private readonly imagePaths = new Map<string, string>();
  private readonly clips = new Map<string, AudioClip>();
  private readonly fonts = new Map<string, Font>();

  public async preload(onProgress?: (ratio: number) => void): Promise<void> {
    const loadDirectory = (directory: string, progress: (finished: number, total: number) => void,
      complete: (error: Error | null) => void): void => {
      resources.loadDir(directory, progress, (error) => complete(error));
    };
    // 字体是首页渲染刚需，与资源目录并行加载，避免串行等待。
    await Promise.all([
      loadRuntimeResourceDirectories(loadDirectory, (ratio) => onProgress?.(ratio * 0.62)),
      this.cacheFont(GAME_CONFIG.fonts.display, TTFFont),
    ]);
    onProgress?.(0.62);

    const framePaths = Array.from(new Set([
      ...GAME_CONFIG.cats.map((cat) => cat.asset),
      ...Object.keys(GAME_CONFIG.art).map((key) => GAME_CONFIG.art[key as keyof typeof GAME_CONFIG.art]),
      ...allCosmetics().reduce<string[]>((paths, item) => {
        if (item.previewAsset) paths.push(item.previewAsset);
        if (item.levelAssets) paths.push(...item.levelAssets);
        if (item.boardAsset) paths.push(item.boardAsset);
        if (item.sparkleAsset) paths.push(item.sparkleAsset);
        if (item.burstAsset) paths.push(item.burstAsset);
        if (item.primaryAsset) paths.push(item.primaryAsset);
        if (item.secondaryAsset) paths.push(item.secondaryAsset);
        if (item.rewardAsset) paths.push(item.rewardAsset);
        if (item.creamAsset) paths.push(item.creamAsset);
        return paths;
      }, []),
    ]));
    let loadedFrames = 0;
    await Promise.all(framePaths.map(async (path) => {
      const [frame, imagePath] = await Promise.all([
        this.loadFrame(path),
        this.loadImagePath(path),
      ]);
      this.frames.set(path, frame);
      if (imagePath) this.imagePaths.set(path, imagePath);
      loadedFrames += 1;
      onProgress?.(0.62 + (loadedFrames / Math.max(1, framePaths.length)) * 0.25);
    }));

    const audioNames = ['move', 'merge', 'game_over'];
    let loadedAudio = 0;
    await Promise.all(audioNames.map(async (name) => {
      const path = `game/audio/${name}`;
      try { this.clips.set(name, await this.loadClip(path)); }
      catch (error) { console.warn(`[Cat2048] Optional audio unavailable: ${path}`, error); }
      loadedAudio += 1;
      onProgress?.(0.87 + (loadedAudio / audioNames.length) * 0.13);
    }));
    onProgress?.(1);
  }

  public frame(path: string): SpriteFrame | undefined { return this.frames.get(path); }
  public imagePath(path: string): string | undefined { return this.imagePaths.get(path); }
  public clip(name: string): AudioClip | undefined { return this.clips.get(name); }
  public font(path: string): Font | undefined { return this.fonts.get(path); }

  private loadFrame(path: string): Promise<SpriteFrame> {
    return new Promise((resolve, reject) => {
      resources.load(path, Texture2D, (error, asset) => {
        if (error) reject(error);
        else {
          const frame = new SpriteFrame();
          frame.texture = asset;
          resolve(frame);
        }
      });
    });
  }

  private loadImagePath(texturePath: string): Promise<string | undefined> {
    const imagePath = texturePath.endsWith('/texture')
      ? texturePath.slice(0, -'/texture'.length)
      : texturePath;
    return new Promise((resolve, reject) => {
      resources.load(imagePath, ImageAsset, (error, asset) => {
        if (error) reject(error);
        else resolve(asset.nativeUrl || undefined);
      });
    });
  }

  private loadClip(path: string): Promise<AudioClip> {
    return new Promise((resolve, reject) => {
      resources.load(path, AudioClip, (error, asset) => {
        if (error) reject(error);
        else resolve(asset);
      });
    });
  }

  private async cacheFont<T extends Font>(path: string, type: new () => T): Promise<void> {
    this.fonts.set(path, await this.loadFont(path, type));
  }

  private loadFont<T extends Font>(path: string, type: new () => T): Promise<T> {
    return new Promise((resolve, reject) => {
      resources.load(path, type, (error, asset) => {
        if (error) reject(error);
        else resolve(asset);
      });
    });
  }
}
