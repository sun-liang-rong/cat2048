import { AudioClip, BitmapFont, Font, ImageAsset, resources, SpriteFrame, Texture2D, TTFFont } from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import { loadResourceDirectory } from './resourceLoading';

export class ArtRepository {
  private readonly frames = new Map<string, SpriteFrame>();
  private readonly imagePaths = new Map<string, string>();
  private readonly clips = new Map<string, AudioClip>();
  private readonly fonts = new Map<string, Font>();

  public async preload(onProgress?: (ratio: number) => void): Promise<void> {
    await loadResourceDirectory((directory, progress, complete) => {
      resources.loadDir(directory, progress, (error) => complete(error));
    }, 'game', onProgress);

    const framePaths = [
      ...GAME_CONFIG.cats.map((cat) => cat.asset),
      ...Object.keys(GAME_CONFIG.art).map((key) => GAME_CONFIG.art[key as keyof typeof GAME_CONFIG.art]),
    ];
    await Promise.all(framePaths.map(async (path) => {
      const [frame, imagePath] = await Promise.all([
        this.loadFrame(path),
        this.loadImagePath(path),
      ]);
      this.frames.set(path, frame);
      if (imagePath) this.imagePaths.set(path, imagePath);
    }));
    await Promise.all([
      this.cacheFont(GAME_CONFIG.fonts.display, TTFFont),
      this.cacheFont(GAME_CONFIG.fonts.numbers, BitmapFont),
    ]);
    await Promise.all(['move', 'merge', 'game_over'].map(async (name) => {
      const path = `game/audio/${name}`;
      try { this.clips.set(name, await this.loadClip(path)); }
      catch (error) { console.warn(`[Cat2048] Optional audio unavailable: ${path}`, error); }
    }));
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
