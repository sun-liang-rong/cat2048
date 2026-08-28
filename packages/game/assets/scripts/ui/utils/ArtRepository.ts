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
  private readonly highLevelAssetsLoaded = new Set<string>();

  /**
   * 关键资源预载（Tier 1）：仅首页与对局必需的资源，阻塞加载进度条。
   * 图鉴/商店/排行榜等次级资源由 {@link preloadSecondary} 在首页可交互后后台加载。
   */
  public async preload(
    equipped: EquippedCosmetics = DEFAULT_EQUIPPED,
    onProgress?: (ratio: number) => void,
  ): Promise<void> {
    const framePaths = this.startupFramePaths(equipped);
    let loadedFrames = 0;
    await Promise.all(framePaths.map(async (path) => {
      await this.loadFrame(path);
      loadedFrames += 1;
      onProgress?.(0.05 + (loadedFrames / Math.max(1, framePaths.length)) * 0.8);
    }));

    await this.cacheFont(GAME_CONFIG.fonts.display, TTFFont);
    onProgress?.(0.9);

    // game_over 属对局必需（结束时刻一次性播放，错过无法补偿），留在关键层。
    const audioNames = ['move', 'merge', 'game_over'];
    let loadedAudio = 0;
    await Promise.all(audioNames.map(async (name) => {
      const path = `game/audio/${name}`;
      try { this.clips.set(name, await this.loadClip(path)); }
      catch (error) { console.warn(`[Cat2048] Optional audio unavailable: ${path}`, error); }
      loadedAudio += 1;
      onProgress?.(0.9 + (loadedAudio / audioNames.length) * 0.1);
    }));
    onProgress?.(1);
  }

  /**
   * 次级资源后台预载（Tier 2）：功能页（图鉴/商店/排行榜）界面图、
   * 设置/任务图标与 BGM。猫咪高等级立绘留到对局预热或图鉴按需加载。
   */
  public async preloadSecondary(_equipped: EquippedCosmetics = DEFAULT_EQUIPPED): Promise<void> {
    await this.loadFramesChunked(this.secondaryFramePaths());
    const audioNames = ['bgm'];
    await Promise.all(audioNames.map(async (name) => {
      const path = `game/audio/${name}`;
      try { this.clips.set(name, await this.loadClip(path)); }
      catch (error) { console.warn(`[Cat2048] Optional audio unavailable: ${path}`, error); }
    }));
  }

  /** 分片加载帧资源：每片之间让出一轮事件循环，避免连续解码阻塞渲染。 */
  private async loadFramesChunked(paths: readonly string[], chunkSize = 4): Promise<void> {
    for (let index = 0; index < paths.length; index += chunkSize) {
      const chunk = paths.slice(index, index + chunkSize);
      await Promise.all(chunk.map((path) => this.loadFrame(path).catch((error) => {
        console.warn(`[Cat2048] Secondary asset unavailable: ${path}`, error);
      })));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  public frame(path: string): SpriteFrame | undefined { return this.frames.get(path); }
  public imagePath(path: string): string | undefined { return this.imagePaths.get(path); }
  public clip(name: string): AudioClip | undefined { return this.clips.get(name); }
  public font(path: string): Font | undefined { return this.fonts.get(path); }

  public async loadFrames(paths: readonly string[]): Promise<void> {
    await Promise.all(paths.map((path) => this.loadFrame(path)));
  }

  /**
   * 去重后按小批次加载纹理，并在每批完成时让出事件循环，避免连续图片解码卡住 UI。
   * 已缓存的路径会直接跳过；回调只包含本批新加载完成的路径。
   */
  public async loadFramesBatched(
    paths: readonly string[],
    batchSize = 2,
    onBatch?: (loadedPaths: readonly string[]) => void,
  ): Promise<void> {
    const pending = Array.from(new Set(paths)).filter((path) => !this.frames.has(path));
    const size = Math.max(1, Math.floor(batchSize));
    for (let index = 0; index < pending.length; index += size) {
      const batch = pending.slice(index, index + size);
      await this.loadFrames(batch);
      onBatch?.(batch);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
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

  /** 懒加载高级资源（5-12 级猫咪） */
  public async loadHighLevelAssets(skinId: string): Promise<void> {
    if (this.highLevelAssetsLoaded.has(skinId)) {
      return; // 已加载，跳过
    }

    const skin = allCosmetics().find((item) => item.id === skinId);
    if (!skin?.levelAssets) {
      console.warn(`[ArtRepository] Skin not found: ${skinId}`);
      return;
    }

    // 仅加载 5-12 级（索引 4-11）
    const highLevels = skin.levelAssets.slice(4);

    try {
      await this.loadFramesBatched(highLevels, 2);
      this.highLevelAssetsLoaded.add(skinId);
      console.log(`[ArtRepository] High-level assets loaded for ${skinId}`);
    } catch (error) {
      console.error(`[ArtRepository] Failed to load high-level assets:`, error);
    }
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

  /** 关键路径（Tier 1）：首页 UI、对局基础、常用按钮、装备皮肤前 4 级与当前装扮。 */
  private startupFramePaths(equipped: EquippedCosmetics): string[] {
    const art = GAME_CONFIG.art;
    const paths = new Set<string>([
      // 首页
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
      // 对局基础
      art.pageBackground,
      art.boardBackground,
      art.gameplayStatsSheet,
      art.tileBase,
      art.tileSelected,
      art.mergeSparkle,
      art.mergeBurst,
      art.maxHalo,
      // 对局与弹窗常用按钮
      art.close,
      art.back,
      art.home,
      art.restart,
      art.share,
      art.coin,
      art.settings,
      art.undo,
      art.removeLowest,
      art.classicMode,
    ]);
    // 当前装备的猫咪皮肤：仅预加载前 4 个等级（1-4 级），5-12 级懒加载
    const equippedSkin = allCosmetics().find((item) => item.id === equipped.catSkin);
    if (equippedSkin?.levelAssets) {
      const eagerLevels = equippedSkin.levelAssets.slice(0, 4); // 仅加载 1-4 级
      for (const path of eagerLevels) paths.add(path);
    }
    const equippedBoard = allCosmetics().find((item) => item.id === equipped.board);
    if (equippedBoard?.boardAsset) paths.add(equippedBoard.boardAsset);
    const equippedEffect = allCosmetics().find((item) => item.id === equipped.effect);
    if (equippedEffect?.sparkleAsset) paths.add(equippedEffect.sparkleAsset);
    if (equippedEffect?.burstAsset) paths.add(equippedEffect.burstAsset);
    return Array.from(paths);
  }

  /** 次级路径（Tier 2）：功能页界面图、设置/任务图标与共享装饰资源。 */
  private secondaryFramePaths(): string[] {
    const cats = GAME_CONFIG.cats;
    const art = GAME_CONFIG.art;
    const paths = new Set<string>([
      // 图鉴/商店/排行榜共用界面图
      art.collectionBackground,
      art.collectionCardLight,
      art.collectionCardLocked,
      art.collectionBackPaw,
      art.collectionLockedCat,
      art.collectionLock,
      // 其余图标与装饰
      art.sparkleSmall,
      art.shareScoreBackground,
      art.info,
      art.collection,
      art.locked,
      art.soundOn,
      art.soundOff,
      art.taskIcons.play,
      art.taskIcons.star,
      art.taskIcons.bolt,
      art.taskIcons.share,
      art.taskIcons.check,
      art.settingsIcons.sound,
      art.settingsIcons.music,
      art.settingsIcons.haptics,
      // 满级展示与排行榜空状态插图（不随装备皮肤变化）
      cats[cats.length - 1].asset,
      cats[0].asset,
    ]);
    return Array.from(paths);
  }
}
