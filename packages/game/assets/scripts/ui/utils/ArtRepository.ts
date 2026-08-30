import { AudioClip, Font, ImageAsset, resources, SpriteFrame, Texture2D, TTFFont } from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { allCosmetics, DEFAULT_EQUIPPED, type EquippedCosmetics } from '../../features/economy/catalog';
import { shopPreviewAssetPaths } from './assetPaths';

export class ArtRepository {
  private readonly frames = new Map<string, SpriteFrame>();
  private readonly imagePaths = new Map<string, string>();
  private readonly clips = new Map<string, AudioClip>();
  private readonly fonts = new Map<string, Font>();
  private readonly frameLoads = new Map<string, Promise<SpriteFrame>>();
  private readonly imageLoads = new Map<string, Promise<string | undefined>>();
  private readonly highLevelAssetsLoaded = new Set<string>();

  /**
   * 首页关键资源（Home Tier）：只阻塞到首页可交互。
   * 对局资源由 {@link preloadGame} 在首页出现后后台预取。
   */
  public async preloadHome(
    _equipped: EquippedCosmetics = DEFAULT_EQUIPPED,
    onProgress?: (ratio: number) => void,
  ): Promise<void> {
    const framePaths = this.homeFramePaths();
    await this.loadFramesChunked(framePaths, 6, (ratio) => onProgress?.(ratio * 0.92), false);
    await this.cacheFont(GAME_CONFIG.fonts.display, TTFFont);
    onProgress?.(1);
  }

  /**
   * 对局关键资源（Game Tier）：首页可交互后后台加载。
   * 音效属于可选资源，缺失时不阻塞进入棋盘。
   */
  public async preloadGame(
    equipped: EquippedCosmetics = DEFAULT_EQUIPPED,
    onProgress?: (ratio: number) => void,
  ): Promise<void> {
    const framePaths = this.gameFramePaths(equipped);
    await this.loadFramesChunked(framePaths, 6, (ratio) => onProgress?.(ratio * 0.85), false);

    const audioNames = ['move', 'merge', 'game_over'];
    let loadedAudio = 0;
    await Promise.all(audioNames.map(async (name) => {
      const path = `game/audio/${name}`;
      try { this.clips.set(name, await this.loadClip(path)); }
      catch (error) { console.warn(`[Cat2048] Optional audio unavailable: ${path}`, error); }
      loadedAudio += 1;
      onProgress?.(0.85 + (loadedAudio / audioNames.length) * 0.15);
    }));
    onProgress?.(1);
  }

  /**
   * 兼容旧调用方：完整启动资源仍可一次性预载，但新启动流程应优先使用
   * {@link preloadHome} + {@link preloadGame}，避免阻塞首页。
   */
  public async preload(
    equipped: EquippedCosmetics = DEFAULT_EQUIPPED,
    onProgress?: (ratio: number) => void,
  ): Promise<void> {
    await this.preloadHome(equipped, (ratio) => onProgress?.(ratio * 0.5));
    await this.preloadGame(equipped, (ratio) => onProgress?.(0.5 + ratio * 0.5));
  }

  /**
   * 次级资源后台预载（Tier 2）：功能页（图鉴/商店/排行榜）界面图、
   * 商店预览图、设置/任务图标与 BGM。猫咪高等级立绘留到对局预热或图鉴按需加载。
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
  private async loadFramesChunked(
    paths: readonly string[],
    chunkSize = 4,
    onProgress?: (ratio: number) => void,
    ignoreErrors = true,
  ): Promise<void> {
    const pending = Array.from(new Set(paths));
    let loaded = 0;
    for (let index = 0; index < pending.length; index += chunkSize) {
      const chunk = pending.slice(index, index + chunkSize);
      await Promise.all(chunk.map((path) => {
        const load = this.loadFrame(path);
        if (!ignoreErrors) return load;
        return load.catch((error) => {
          console.warn(`[Cat2048] Secondary asset unavailable: ${path}`, error);
        });
      }));
      loaded += chunk.length;
      onProgress?.(loaded / Math.max(1, pending.length));
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

  /** 首页关键路径：只包含首页首次绘制需要的纹理。 */
  private homeFramePaths(): string[] {
    const art = GAME_CONFIG.art;
    return Array.from(new Set<string>([
      art.homeBackground,
      art.homeCatRoom,
      art.homePlayPaw,
      art.homeBottomDock,
      art.homeCollection,
      art.homeShop,
      art.homeTasks,
      art.homeGuide,
      art.homeSettings,
      art.homeCoin,
      art.homePlus,
      art.homeLeaderboardButton,
      art.homeCheckinButton,
    ]));
  }

  /** 对局关键路径：棋盘、HUD、按钮、特效及当前装备的前 4 级立绘。 */
  private gameFramePaths(equipped: EquippedCosmetics): string[] {
    const art = GAME_CONFIG.art;
    const paths = new Set<string>([
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
    // 商店首屏直接使用缓存中的预览图，避免先显示占位卡再整组重绘。
    const catalog = allCosmetics();
    for (const category of ['cat-skin', 'board', 'effect'] as const) {
      for (const path of shopPreviewAssetPaths(catalog, category)) paths.add(path);
    }
    return Array.from(paths);
  }
}
