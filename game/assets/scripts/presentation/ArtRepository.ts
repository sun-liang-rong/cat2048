import { AudioClip, resources, SpriteFrame, Texture2D, TTFFont } from 'cc';
import { GAME_CONFIG } from '../infrastructure/gameConfig';

export class ArtRepository {
  private readonly frames = new Map<string, SpriteFrame>();
  private readonly clips = new Map<string, AudioClip>();
  private readonly fonts = new Map<string, TTFFont>();

  public async preload(): Promise<void> {
    const framePaths = [
      ...GAME_CONFIG.cats.map((cat) => cat.asset),
      ...Object.keys(GAME_CONFIG.art).map((key) => GAME_CONFIG.art[key as keyof typeof GAME_CONFIG.art]),
    ];
    await Promise.all(framePaths.map(async (path) => {
      try { this.frames.set(path, await this.loadFrame(path)); }
      catch (error) { console.error(`[Cat2048] Failed to load sprite: ${path}`, error); }
    }));
    await Promise.all(Object.values(GAME_CONFIG.fonts).map(async (path) => {
      try { this.fonts.set(path, await this.loadFont(path)); }
      catch (error) { console.error(`[Cat2048] Failed to load font: ${path}`, error); }
    }));
    await Promise.all(['move', 'merge', 'game_over'].map(async (name) => {
      const path = `game/audio/${name}`;
      try { this.clips.set(name, await this.loadClip(path)); }
      catch (error) { console.warn(`[Cat2048] Optional audio unavailable: ${path}`, error); }
    }));
  }

  public frame(path: string): SpriteFrame | undefined { return this.frames.get(path); }
  public clip(name: string): AudioClip | undefined { return this.clips.get(name); }
  public font(path: string): TTFFont | undefined { return this.fonts.get(path); }

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

  private loadClip(path: string): Promise<AudioClip> {
    return new Promise((resolve, reject) => {
      resources.load(path, AudioClip, (error, asset) => {
        if (error) reject(error);
        else resolve(asset);
      });
    });
  }

  private loadFont(path: string): Promise<TTFFont> {
    return new Promise((resolve, reject) => {
      resources.load(path, TTFFont, (error, asset) => {
        if (error) reject(error);
        else resolve(asset);
      });
    });
  }
}
