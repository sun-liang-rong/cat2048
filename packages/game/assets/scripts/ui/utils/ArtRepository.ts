import { AudioClip, Font, ImageAsset, resources, SpriteFrame, Texture2D, TTFFont } from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { allCosmetics, DEFAULT_EQUIPPED, type EquippedCosmetics } from '../../features/economy/catalog';

export class ArtRepository {
  private readonly frames = new Map<string, SpriteFrame>();
  private readonly imagePaths = new Map<string, string>();
  private readonly clips = new Map<string, AudioClip>();
  private readonly fonts = new Map<string, Font>();
  private readonly frameLoads = new Map<string, Promise<SpriteFrame>>();
  private readonly imageLoads = new Map<string, Promise<string | undefined>>();

  public async preload(
    equipped: EquippedCosmetics = DEFAULT_EQUIPPED,
    onProgress?: (ratio: number) => void,
  ): Promise<void> {
    const framePaths = this.startupFramePaths(equipped);
    let loadedFrames = 0;
    await Promise.all(framePaths.map(async (path) => {
      await this.loadFrame(path);
      loadedFrames += 1;
      onProgress?.(0.05 + (loadedFrames / Math.max(1, framePaths.length)) * 0.75);
    }));

    await this.cacheFont(GAME_CONFIG.fonts.display, TTFFont);
    onProgress?.(0.82);

    const audioNames = ['move', 'merge', 'game_over', 'bgm'];
    let loadedAudio = 0;
    await Promise.all(audioNames.map(async (name) => {
      const path = `game/audio/${name}`;
      try { this.clips.set(name, await this.loadClip(path)); }
      catch (error) { console.warn(`[Cat2048] Optional audio unavailable: ${path}`, error); }
      loadedAudio += 1;
      onProgress?.(0.82 + (loadedAudio / audioNames.length) * 0.18);
    }));
    onProgress?.(1);
  }

  public frame(path: string): SpriteFrame | undefined { return this.frames.get(path); }
  public imagePath(path: string): string | undefined { return this.imagePaths.get(path); }
  public clip(name: string): AudioClip | undefined { return this.clips.get(name); }
  public font(path: string): Font | undefined { return this.fonts.get(path); }

  public async loadFrames(paths: readonly string[]): Promise<void> {
    await Promise.all(paths.map((path) => this.loadFrame(path)));
  }

  public async loadShareImagePath(path: string): Promise<string | undefined> {
    if (this.imagePaths.has(path)) return this.imagePaths.get(path);
    const existing = this.imageLoads.get(path);
    if (existing) return existing;
    const promise = this.loadImagePath(path).then((value) => {
      if (value) this.imagePaths.set(path, value);
      return value;
    }).finally(() => this.imageLoads.delete(path));
    this.imageLoads.set(path, promise);
    return promise;
  }

  private async loadFrame(path: string): Promise<SpriteFrame> {
    const cached = this.frames.get(path);
    if (cached) return cached;
    const existing = this.frameLoads.get(path);
    if (existing) return existing;
    const promise = new Promise<SpriteFrame>((resolve, reject) => {
      resources.load(path, Texture2D, (error, asset) => {
        if (error) reject(error);
        else {
          const frame = new SpriteFrame();
          frame.texture = asset;
          this.frames.set(path, frame);
          resolve(frame);
        }
      });
    }).finally(() => this.frameLoads.delete(path));
    this.frameLoads.set(path, promise);
    return promise;
  }

  private async loadImagePath(texturePath: string): Promise<string | undefined> {
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

  private startupFramePaths(equipped: EquippedCosmetics): string[] {
    const cats = GAME_CONFIG.cats;
    const art = GAME_CONFIG.art;
    const paths = new Set<string>([
      art.homeBackground,
      art.homeCatRoom,
      art.homePlayPaw,
      art.homeBottomDock,
      art.homeCollection,
      art.homeShop,
      art.homeTasks,
      art.homeSettings,
      art.homeCoin,
      art.homePlus,
      art.homeLeaderboardButton,
      art.homeCheckinButton,
      art.collectionBackground,
      art.collectionCardLight,
      art.collectionCardLocked,
      art.collectionBackPaw,
      art.collectionLockedCat,
      art.collectionLock,
      art.pageBackground,
      art.boardBackground,
      art.gameplayStatsSheet,
      art.tileBase,
      art.tileSelected,
      art.sparkleSmall,
      art.mergeSparkle,
      art.mergeBurst,
      art.maxHalo,
      art.close,
      art.back,
      art.home,
      art.info,
      art.collection,
      art.coin,
      art.soundOn,
      art.soundOff,
      art.settings,
      art.share,
      art.undo,
      art.removeLowest,
      art.classicMode,
      art.restart,
      art.locked,
      cats[cats.length - 1].asset,
    ]);
    // 当前装备的猫咪皮肤需要全部等级，游戏中任意等级都可能出现。
    const equippedSkin = allCosmetics().find((item) => item.id === equipped.catSkin);
    if (equippedSkin?.levelAssets) for (const path of equippedSkin.levelAssets) paths.add(path);
    const equippedBoard = allCosmetics().find((item) => item.id === equipped.board);
    if (equippedBoard?.boardAsset) paths.add(equippedBoard.boardAsset);
    const equippedEffect = allCosmetics().find((item) => item.id === equipped.effect);
    if (equippedEffect?.sparkleAsset) paths.add(equippedEffect.sparkleAsset);
    if (equippedEffect?.burstAsset) paths.add(equippedEffect.burstAsset);
    return Array.from(paths);
  }
}
