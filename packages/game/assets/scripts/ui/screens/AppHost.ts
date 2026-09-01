/**
 * 应用宿主：页面导航、屏幕管理、GameFlowHost 实现。
 *
 * 从 Cat2048Boot 拆出，内部创建 EconomyPanelsController / LeaderboardController / GameFlowController。
 * Cat2048Boot 只保留 Cocos 生命周期、Canvas 设置、键盘输入。
 */
import { Node } from 'cc';
import {
  type EconomyMutationResult,
  type EconomyRepository,
  type EconomySnapshot,
} from '../../features/economy/economy';
import type { DailyTaskRepository } from '../../features/tasks/dailyTasks';
import { RunSessionStore, type SavedRunMode } from '../../features/storage/runSession';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { HapticController } from '../../infrastructure/HapticController';
import { ResultShareController } from '../../infrastructure/ResultShareController';
import type { SharePurpose, ShareResult } from '../../infrastructure/ResultShareController';
import type { RewardedVideoAdService } from '../../infrastructure/WechatRewardedVideoAd';
import { StartupMetrics } from '../../infrastructure/StartupMetrics';
import { runtimeStorage } from '../../features/storage/runtime';
import {
  highestLevelOfTiles,
  type LeaderboardClient,
} from '../../features/leaderboard/leaderboard';
import type { SaveDataV3 } from '../../features/storage/storage';
import type { ArtRepository } from '../utils/ArtRepository';
import type { AudioController } from '../components/AudioController';
import { ModalView, type DialogActions } from '../panels/ModalView';
import type { HomeView, HomeViewModel } from './HomeView';
import type { LoadingView } from './LoadingView';
import type { LeaderboardView } from './LeaderboardView';
import type { CosmeticRuntime } from '../components/CosmeticRuntime';
import type { DailyRewardView } from '../panels/DailyRewardView';
import type { TaskPanelView } from '../panels/TaskPanelView';
import type { CatDetailModal } from '../panels/CatDetailModal';
import type { ShopView } from './ShopView';
import type { CollectionView } from './CollectionView';
import { SettingsPanel } from '../panels/SettingsPanel';
import { GuidePanelView } from '../panels/GuidePanelView';
import { settingsOrigin } from '../utils/settingsNavigation';
import { EconomyPanelsController, type ScreenName } from '../controllers/EconomyPanelsController';
import { LeaderboardController } from '../controllers/LeaderboardController';
import { GameFlowController } from './GameFlowController';
import type { GameFlowHost } from './GameFlowController';
import { createUiNode, setRuntimeFonts } from '../utils/uiFactory';
import { stopTweens, tweenOpacity } from '../utils/tweenAsync';
import {
  markCocosLoadingError,
  markCocosLoadingReady,
  reportCocosLoadingProgress,
} from '../utils/cocosLoadingBridge';
import { GamePreparingOverlay } from '../components/GamePreparingOverlay';
import { mergeCollectionLevels } from '../../features/gameplay/collectionProgress';

// ---- 平台抽象 ----

export interface HostPlatform {
  readonly node: Node;
  readonly isValid: boolean;
  scheduleOnce(callback: () => void, delay: number): void;
  unschedule(callback: () => void): void;
}

// ---- 服务依赖（全部由 Cat2048Boot 创建并注入） ----

export interface HostServices {
  readonly art: ArtRepository;
  readonly cosmetics: CosmeticRuntime;
  readonly economy: EconomyRepository;
  readonly tasks: DailyTaskRepository;
  readonly runSession: RunSessionStore;
  readonly leaderboard: LeaderboardClient;
  readonly haptics: HapticController;
  readonly resultShare: ResultShareController;
  readonly rewardedVideoAd: RewardedVideoAdService;
  readonly audio: AudioController;
  // 视图
  readonly homeView: HomeView;
  readonly collectionView: CollectionView;
  readonly leaderboardView: LeaderboardView;
  readonly shopView: ShopView;
  readonly loadingView: LoadingView;
  readonly dailyRewardView: DailyRewardView;
  readonly taskPanel: TaskPanelView;
  readonly catDetailModal: CatDetailModal;
  readonly settings: SettingsPanel;
  readonly guide: GuidePanelView;
  readonly dialogs: ModalView;
}

export class AppHost implements GameFlowHost {
  // ---- 子控制器（内部创建） ----
  public readonly economyPanels: EconomyPanelsController;
  public readonly leaderboardCtrl: LeaderboardController;
  public readonly flow: GameFlowController;

  // ---- 尺寸与安全区 ----
  private uiWidthValue: number;
  private uiHeightValue: number;
  private safeTop: number;
  private safeBottom: number;

  // ---- 状态 ----
  private saveValue: SaveDataV3;
  private economySnapshotValue!: EconomySnapshot;
  private screenRoot: Node | null = null;
  private homeRoot: Node | null = null;
  private inputLocked = false;
  private shareInProgress = false;
  /** 首页资源是否已就绪；首页显示不再等待对局资源。 */
  private assetsReady = false;
  private gameAssetsReady = false;
  private secondaryAssetsReady = false;
  private gameAssetsPromise: Promise<void> | null = null;
  private secondaryAssetsPromise: Promise<void> | null = null;
  private gameAssetsError: unknown = null;
  /** 对局预取对应的装备组合；远程同步或换装后需要重新校验。 */
  private gameAssetsEquippedKey = '';
  private readonly gamePreparingOverlay = new GamePreparingOverlay();
  private homeTransitionToken = 0;
  private sceneToken = 0;
  private currentScreen: ScreenName = 'loading';
  private readonly startupMetrics = new StartupMetrics();

  public constructor(
    private readonly platform: HostPlatform,
    private readonly svc: HostServices,
    initialSave: SaveDataV3,
    uiWidth: number,
    uiHeight: number,
    safeTop: number,
    safeBottom: number,
  ) {
    this.saveValue = initialSave;
    this.uiWidthValue = uiWidth;
    this.uiHeightValue = uiHeight;
    this.safeTop = safeTop;
    this.safeBottom = safeBottom;

    // 创建 EconomyPanelsController
    this.economyPanels = new EconomyPanelsController({
      art: svc.art,
      cosmetics: svc.cosmetics,
      economy: svc.economy,
      tasks: svc.tasks,
      dialogs: svc.dialogs,
      dailyRewardView: svc.dailyRewardView,
      taskPanel: svc.taskPanel,
      shopView: svc.shopView,
      collectionView: svc.collectionView,
      catDetailModal: svc.catDetailModal,
      getScreenRoot: () => this.screenRoot,
      getCurrentScreen: () => this.currentScreen,
      getSceneToken: () => this.sceneToken,
      getSave: () => this.saveValue,
      getEconomySnapshot: () => this.economySnapshotValue,
      getSize: () => ({ width: this.uiWidthValue, height: this.uiHeightValue }),
      topInset: () => this.safeTop,
      bottomInset: () => this.safeBottom,
      isInputLocked: () => this.inputLocked,
      lockInput: () => { this.inputLocked = true; },
      unlockInput: () => { this.inputLocked = false; },
      applyEconomyResult: (result) => this.applyEconomyResult(result),
      applyEconomySnapshot: (snapshot) => this.applyEconomySnapshot(snapshot),
      showNotice: (text) => this.showNotice(text),
      showHome: () => this.showHome(),
      refreshHome: () => {
        if (this.currentScreen === 'home' && this.homeRoot?.isValid) {
          svc.homeView.refresh(this.homeViewModel());
        }
      },
      showGame: (resume, mode) => this.showGame(resume, mode),
      makeScreen: (name) => this.makeScreen(name),
      clearScreen: () => this.clearScreen(),
      setCurrentScreen: (name) => { this.currentScreen = name; },
    });

    // 创建 LeaderboardController
    this.leaderboardCtrl = new LeaderboardController({
      leaderboard: svc.leaderboard,
      leaderboardView: svc.leaderboardView,
      getSave: () => this.saveValue,
      getSize: () => ({ width: this.uiWidthValue, height: this.uiHeightValue }),
      topInset: () => this.safeTop,
      bottomInset: () => this.safeBottom,
      getCurrentScreen: () => this.currentScreen,
      getSceneToken: () => this.sceneToken,
      showHome: () => this.showHome(),
      makeScreen: (name) => this.makeScreen(name),
      clearScreen: () => this.clearScreen(),
      setCurrentScreen: (name) => { this.currentScreen = name; },
    });

    // 创建 GameFlowController（传入 this 作为 GameFlowHost）
    this.flow = new GameFlowController({
      art: svc.art,
      cosmetics: svc.cosmetics,
      audio: svc.audio,
      haptics: svc.haptics,
      leaderboard: svc.leaderboard,
      economy: svc.economy,
      rewardedVideoAd: svc.rewardedVideoAd,
      tasks: svc.tasks,
      runSession: svc.runSession,
      host: this,
      actions: {
        onBack: () => this.confirmLeave(),
        onSettings: () => { void this.openAfterSecondary(() => this.showSettingsDialog()); },
        onCollection: () => {
          void this.openAfterSecondary(() => this.economyPanels.showCollection('game'));
        },
        onHome: () => this.showHome(),
        onReplay: () => this.showGame(true, this.flow.mode),
      },
    });
  }

  // ---- 尺寸更新 ----

  public updateLayout(uiWidth: number, uiHeight: number, safeTop: number, safeBottom: number): void {
    this.uiWidthValue = uiWidth;
    this.uiHeightValue = uiHeight;
    this.safeTop = safeTop;
    this.safeBottom = safeBottom;
  }

  // ---- 初始化 ----

  public async initialize(): Promise<void> {
    this.assetsReady = false;
    this.gameAssetsReady = false;
    this.secondaryAssetsReady = false;
    this.gameAssetsPromise = null;
    this.secondaryAssetsPromise = null;
    this.gameAssetsError = null;
    this.gameAssetsEquippedKey = '';
    this.gamePreparingOverlay.close();
    this.homeTransitionToken += 1;
    this.startupMetrics.mark('boot');
    this.svc.loadingView.reset();
    this.showLoading();
    try {
      this.applyEconomySnapshot(await this.svc.economy.load());
    } catch (error) {
      console.error('[Cat2048] Startup data loading failed', error);
      this.svc.loadingView.showError();
      markCocosLoadingError(error);
      return;
    }
    const { runStartupSequence } = await import('../utils/startupSequence');
    await runStartupSequence({
      // 首页是首屏阻塞层；对局资源在 onReady 后后台预取。
      preload: () => this.svc.art.preloadHome(
        this.saveValue.economy.equipped,
        (ratio) => {
          this.svc.loadingView.setProgress(ratio);
          reportCocosLoadingProgress(ratio);
        },
      ),
      isActive: () => this.platform.isValid,
      onReady: () => {
        this.assetsReady = true;
        this.startupMetrics.mark('home-ready');
        reportCocosLoadingProgress(1);
        markCocosLoadingReady();
        this.beginHomeTransition();
        // 首页已可交互：优先后台预取对局资源，避免次级页面请求抢占首局带宽。
        const gamePreload = this.beginGameAssetsPreload();
        this.secondaryAssetsPromise = gamePreload.then(
          () => this.preloadSecondaryAssets(),
          () => this.preloadSecondaryAssets(),
        );
      },
      onError: (error) => {
        console.error('[Cat2048] Startup asset loading failed', error);
        this.svc.loadingView.showError();
        markCocosLoadingError(error);
      },
    });
  }

  /** 首页就绪后后台预取对局资源；完成后点击开始无需再等待。 */
  private beginGameAssetsPreload(): Promise<void> {
    this.gameAssetsReady = false;
    this.gameAssetsError = null;
    this.gameAssetsEquippedKey = this.equippedKey(this.saveValue.economy.equipped);
    const promise = this.preloadGameAssets();
    this.gameAssetsPromise = promise;
    return promise;
  }

  private async preloadGameAssets(): Promise<void> {
    try {
      await this.svc.art.preloadGame(this.saveValue.economy.equipped);
      this.gameAssetsReady = true;
    } catch (error) {
      // 后台预取失败不应产生未处理 Promise rejection；用户点击开始时会看到可重试提示。
      this.gameAssetsError = error;
      console.warn('[Cat2048] Game assets loading failed', error);
    }
  }

  /** 首页就绪后后台加载 Tier 2 资源，完成后输出启动性能埋点。 */
  private async preloadSecondaryAssets(): Promise<void> {
    try {
      await this.svc.art.preloadSecondary(this.saveValue.economy.equipped);
      this.secondaryAssetsReady = true;
    } catch (error) {
      console.warn('[Cat2048] Secondary asset loading failed', error);
    } finally {
      this.startupMetrics.mark('secondary-loaded');
      this.startupMetrics.report();
      // BGM 属于次级资源：就绪后补启动音乐。已播放或用户关闭音乐时内部会直接跳过。
      this.svc.audio.playMusic();
    }
  }

  // ---- GameFlowHost 实现 ----

  public isOnGameScreen(): boolean { return this.currentScreen === 'game'; }
  public isInputLocked(): boolean { return this.inputLocked; }
  public lockInput(): void { this.inputLocked = true; }
  public unlockInput(): void { this.inputLocked = false; }
  public getSave(): SaveDataV3 { return this.saveValue; }
  public commitSave(save: SaveDataV3): void { this.saveValue = save; runtimeStorage.save(save); }
  public getCoins(): number { return this.economySnapshotValue.coins; }
  public applyEconomyResult(result: EconomyMutationResult): void { this.applyEconomySnapshot(result); }

  public showNotice(text: string): void {
    this.svc.dialogs.showNotice(this.screenRoot, text, this.currentScreen === 'game'
      ? { anchor: 'top', offset: this.safeTop + 186 }
      : undefined);
  }

  public async requestShare(purpose: SharePurpose): Promise<ShareResult | null> {
    if (this.shareInProgress || !this.screenRoot) return null;
    const shareRoot = this.screenRoot;
    const token = this.sceneToken;
    const highestLevel = highestLevelOfTiles(this.flow.board.tiles);
    const cat = GAME_CONFIG.cats[highestLevel - 1];
    let bg: string | undefined;
    let catImg: string | undefined;
    try {
      [bg, catImg] = await Promise.all([
        this.svc.art.loadShareImagePath(GAME_CONFIG.art.shareScoreBackground),
        this.svc.art.loadShareImagePath(cat.asset),
      ]);
    } catch { /* 静默 */ }
    if (!bg || !catImg) {
      this.svc.dialogs.showNotice(this.screenRoot, '分享卡片素材暂不可用');
      return 'failed';
    }
    this.shareInProgress = true;
    return this.svc.resultShare.share({
      purpose, score: this.flow.score, bestScore: this.saveValue.highScore,
      catLevel: highestLevel, catName: cat.name, backgroundPath: bg, catPath: catImg,
    }).then((shared) => {
      this.shareInProgress = false;
      if (token !== this.sceneToken || this.screenRoot !== shareRoot) return null;
      if (shared === 'shared') { this.svc.tasks.recordEvent('share-once'); return shared; }
      this.svc.dialogs.showNotice(shareRoot, shared === 'unsupported'
        ? '请在微信小游戏中分享给好友或群' : '分享卡片生成失败，请稍后重试');
      return shared;
    });
  }

  // ---- 页面导航 ----

  public showLoading(): void {
    this.clearScreen();
    this.currentScreen = 'loading';
    this.svc.loadingView.build(this.makeScreen('Loading'), this.uiWidthValue, this.uiHeightValue,
      () => { void this.initialize(); });
  }

  public showHome(): void {
    this.clearScreen();
    this.currentScreen = 'home';
    if (this.homeRoot?.isValid) {
      this.homeRoot.active = true;
      this.screenRoot = this.homeRoot;
      this.svc.homeView.refresh(this.homeViewModel());
      this.svc.homeView.resumeAnimations();
      return;
    }
    this.homeRoot = this.makeScreen('Home');
    this.svc.homeView.build(this.homeRoot, this.homeViewModel(), {
      onPlay: () => { if (this.assetsReady) void this.startGameWhenReady(); },
      onRestart: () => { if (this.assetsReady) void this.restartGameWhenReady(); },
      onDailyChallenge: () => {
        if (this.assetsReady) void this.startDailyChallengeWhenReady();
      },
      onCollection: () => {
        if (this.assetsReady) void this.openAfterSecondary(
          () => this.economyPanels.showCollection('home'));
      },
      onLeaderboard: () => {
        if (this.assetsReady) void this.openAfterSecondary(
          () => this.leaderboardCtrl.showLeaderboard());
      },
      onShop: () => {
        if (this.assetsReady) void this.openAfterSecondary(
          () => this.economyPanels.showShop());
      },
      onDailyReward: () => {
        if (this.assetsReady) void this.openAfterSecondary(
          () => this.economyPanels.showDailyReward());
      },
      onTasks: () => {
        if (this.assetsReady) void this.openAfterSecondary(
          () => this.economyPanels.showTasks());
      },
      onGuide: () => {
        if (this.assetsReady) void this.openAfterSecondary(() => this.showGuideDialog());
      },
      onToggleSound: () => { if (this.assetsReady) this.toggleSound(); },
      onSettings: () => {
        if (this.assetsReady) void this.openAfterSecondary(() => this.showSettingsDialog());
      },
    });
    this.economyPanels.promptDailyRewardIfDue();
  }

  public showGame(startNewGame: boolean, mode: SavedRunMode = this.flow.mode): void {
    this.clearScreen();
    this.currentScreen = 'game';
    if (startNewGame) this.flow.startRun(mode);
    this.flow.buildGameScreen(this.makeScreen('Game'), {
      uiWidth: this.uiWidthValue, uiHeight: this.uiHeightValue,
      topInset: this.safeTop, bottomInset: this.safeBottom,
      score: this.flow.score, highScore: this.saveValue.highScore,
      moves: this.flow.moves, merges: this.flow.merges,
      board: this.flow.board, items: this.flow.items,
      unlockedCount: this.saveValue.unlockedCatLevels.length,
    });
  }

  public applyResize(screenBefore: ScreenName): void {
    if (!this.assetsReady) { this.showLoading(); return; }
    if (screenBefore === 'loading') { this.showLoading(); this.beginHomeTransition(); return; }
    if (screenBefore === 'game') this.showGame(false);
    else if (screenBefore === 'collection') this.economyPanels.showCollection(this.economyPanels.lastCollectionOrigin);
    else if (screenBefore === 'shop') this.economyPanels.showShop();
    else if (screenBefore === 'leaderboard') this.leaderboardCtrl.showLeaderboard();
    else {
      if (this.homeRoot?.isValid) {
        stopTweens(this.homeRoot); this.svc.homeView.destroy(); this.homeRoot.destroy(); this.homeRoot = null;
      }
      this.showHome();
    }
  }

  // ---- 公开状态 ----

  public get currentScreenName(): ScreenName { return this.currentScreen; }
  public get sceneTokenValue(): number { return this.sceneToken; }
  public get save(): SaveDataV3 { return this.saveValue; }
  public get economySnapshot(): EconomySnapshot { return this.economySnapshotValue; }

  // ---- 弹窗 ----

  public confirmLeave(): void {
    this.showDialog('返回主页？', '本局会自动保存，下次可继续冒险。', '继续游戏', '返回主页',
      () => this.showHome(), undefined, undefined, { cancelTone: 'primary', confirmTone: 'secondary' });
  }

  public showGuideDialog(): void {
    if (!this.screenRoot) return;
    this.inputLocked = true;
    this.svc.guide.show(this.screenRoot, {
      onClose: () => { this.inputLocked = false; this.showHome(); },
    });
  }

  public showSettingsDialog(): void {
    if (!this.screenRoot) return;
    const origin = settingsOrigin(this.flow.isBoardActive());
    this.inputLocked = true;
    this.svc.settings.show(this.screenRoot, {
      soundEnabled: this.saveValue.soundEnabled,
      musicEnabled: this.saveValue.musicEnabled,
      hapticsEnabled: this.saveValue.hapticsEnabled,
    }, {
      onSoundChange: (enabled) => {
        this.saveValue = { ...this.saveValue, soundEnabled: enabled };
        this.svc.audio.enabled = enabled;
        runtimeStorage.save(this.saveValue);
      },
      onMusicChange: (enabled) => {
        this.saveValue = { ...this.saveValue, musicEnabled: enabled };
        this.svc.audio.setMusicEnabled(enabled);
        runtimeStorage.save(this.saveValue);
      },
      onHapticsChange: (enabled) => {
        this.saveValue = { ...this.saveValue, hapticsEnabled: enabled };
        this.svc.haptics.enabled = enabled;
        runtimeStorage.save(this.saveValue);
      },
      onClose: () => { this.inputLocked = false; if (origin === 'home') this.showHome(); },
    });
  }

  // ---- 清理 ----

  public teardown(): void {
    this.sceneToken += 1;
    this.homeTransitionToken += 1;
    this.inputLocked = false;
    this.gamePreparingOverlay.close();
    this.shareInProgress = false;
    this.economyPanels.resetOverlays();
    this.flow.teardown();
    this.svc.rewardedVideoAd.destroy();
    if (this.screenRoot && this.screenRoot !== this.homeRoot) {
      stopTweens(this.screenRoot); this.screenRoot.destroy();
    }
    this.screenRoot = null;
    if (this.homeRoot?.isValid) { this.svc.homeView.pauseAnimations(); this.homeRoot.active = false; }
  }

  // ---- 私有方法 ----

  private beginHomeTransition(): void {
    const token = ++this.homeTransitionToken;
    this.svc.loadingView.setProgress(1);
    this.platform.scheduleOnce(() => {
      if (token !== this.homeTransitionToken || this.currentScreen !== 'loading') return;
      const loadingRoot = this.screenRoot;
      if (!loadingRoot?.isValid) return;
      void tweenOpacity(loadingRoot, 0, 0.18).then(() => {
        if (token !== this.homeTransitionToken || this.screenRoot !== loadingRoot) return;
        setRuntimeFonts(this.svc.art.font(GAME_CONFIG.fonts.display) ?? null, null);
        this.svc.audio.playMusic();
        this.showHome();
        void this.leaderboardCtrl.authenticate();
        void this.leaderboardCtrl.flushPendingScores();
      });
    }, 0.15);
  }

  private homeViewModel(): HomeViewModel {
    const pending = this.svc.runSession.load();
    return {
      highScore: this.saveValue.highScore,
      collectionCount: this.saveValue.unlockedCatLevels.length,
      coins: this.economySnapshotValue.coins,
      canClaimDaily: this.economySnapshotValue.canClaimDaily,
      dailyReward: this.economySnapshotValue.dailyReward,
      taskClaimable: this.svc.tasks.snapshot().canClaim,
      soundEnabled: this.saveValue.soundEnabled,
      hasPendingRun: !!pending,
      pendingRunScore: pending?.score ?? 0,
      uiWidth: this.uiWidthValue, uiHeight: this.uiHeightValue,
      topInset: this.safeTop, bottomInset: this.safeBottom,
    };
  }

  /** 等待后台对局资源预取；等待期间只遮挡首页输入，不重建整张 Loading 页。 */
  private async ensureGameAssets(): Promise<boolean> {
    if (this.inputLocked) return false;
    const equippedKey = this.equippedKey(this.saveValue.economy.equipped);
    if (this.gameAssetsReady && this.gameAssetsEquippedKey === equippedKey) return true;
    // 同步期间服务器可能返回了新的装备组合；预取旧组合不能直接复用。
    // 即使旧预取尚未完成也要启动新组合的请求，否则点击开始可能等待旧资源后
    // 直接进入棋盘，导致新皮肤/棋盘出现占位或默认素材。
    if (this.gameAssetsEquippedKey !== equippedKey) {
      this.beginGameAssetsPreload();
    }
    if (this.gameAssetsError) {
      // 资源请求可能只是临时网络失败；已缓存的资源会被 ArtRepository 去重，
      // 因此再次点击可以只重试失败的路径。
      this.beginGameAssetsPreload();
    }
    const pending = this.gameAssetsPromise;
    if (!pending) {
      this.showNotice('棋盘资源尚未开始加载');
      return false;
    }

    const token = this.sceneToken;
    const parent = this.screenRoot;
    const closeOverlay = parent
      ? this.gamePreparingOverlay.show(parent, this.uiWidthValue, this.uiHeightValue)
      : () => undefined;
    this.inputLocked = true;
    try {
      await pending;
    } finally {
      closeOverlay();
      this.inputLocked = false;
    }

    if (token !== this.sceneToken || this.currentScreen !== 'home') return false;
    if (this.gameAssetsError || !this.gameAssetsReady) {
      this.showNotice('棋盘资源加载失败，请重试');
      return false;
    }
    return true;
  }

  private async openAfterSecondary(action: () => void): Promise<void> {
    if (this.inputLocked) return;
    if (this.secondaryAssetsReady || !this.secondaryAssetsPromise) {
      action();
      return;
    }
    const token = this.sceneToken;
    const screenBefore = this.currentScreen;
    this.inputLocked = true;
    try {
      await this.secondaryAssetsPromise;
    } finally {
      this.inputLocked = false;
    }
    if (token !== this.sceneToken || this.currentScreen !== screenBefore) return;
    action();
  }

  private async startGameWhenReady(): Promise<void> {
    if (await this.ensureGameAssets()) this.startGame();
  }

  private async restartGameWhenReady(): Promise<void> {
    if (await this.ensureGameAssets()) this.restartGame();
  }

  private async startDailyChallengeWhenReady(): Promise<void> {
    if (await this.ensureGameAssets()) this.startDailyChallenge();
  }

  private startGame(): void {
    const pending = this.svc.runSession.load();
    if (pending) { this.flow.resumeRun(pending); this.showGame(false); return; }
    this.showGame(true, 'classic');
  }

  private restartGame(): void { this.svc.runSession.clear(); this.showGame(true, 'classic'); }
  private startDailyChallenge(): void { this.svc.runSession.clear(); this.showGame(true, 'daily-challenge'); }

  private toggleSound(): void {
    this.saveValue = { ...this.saveValue, soundEnabled: !this.saveValue.soundEnabled };
    runtimeStorage.save(this.saveValue); this.svc.audio.enabled = this.saveValue.soundEnabled;
  }

  private applyEconomySnapshot(snapshot: EconomySnapshot): void {
    // Unlocks can be discovered during a run while a remote snapshot is in
    // flight. They are monotonic, so never replace newer local levels with an
    // older response; also repair any historical gaps (e.g. [1..7, 10]).
    const unlockedCatLevels = mergeCollectionLevels(
      this.saveValue?.unlockedCatLevels ?? [],
      snapshot.unlockedCatLevels,
    );
    const mergedSnapshot = { ...snapshot, unlockedCatLevels };
    this.economySnapshotValue = mergedSnapshot;
    this.saveValue = {
      ...runtimeStorage.load(),
      unlockedCatLevels,
      economy: {
        coins: snapshot.coins, ownedItemIds: snapshot.ownedItemIds, equipped: snapshot.equipped,
        lastDailyClaimDate: snapshot.lastDailyClaimDate, dailyStreak: snapshot.dailyStreak,
        dailyCounterDate: snapshot.dailyCounterDate,
        settledRunIds: snapshot.settledRunIds,
        undoItems: snapshot.undoItems, spawnItems: snapshot.spawnItems,
        shuffleItems: snapshot.shuffleItems, eraseItems: snapshot.eraseItems,
        dailyAdUndo: snapshot.dailyAdUndo, dailyAdSpawn: snapshot.dailyAdSpawn,
        dailyAdShuffle: snapshot.dailyAdShuffle, dailyAdErase: snapshot.dailyAdErase,
        dailyLoginClaimed: snapshot.dailyLoginClaimed, dailyShareUndo: snapshot.dailyShareUndo,
      },
    };
    this.svc.cosmetics.setEquipped(this.saveValue.economy.equipped);
    if (this.currentScreen === 'home' && this.homeRoot?.isValid) {
      this.svc.homeView.refresh(this.homeViewModel());
    }
    if (this.currentScreen === 'collection') {
      this.svc.collectionView.refreshUnlockState(unlockedCatLevels);
    }
  }

  private equippedKey(equipped: SaveDataV3['economy']['equipped']): string {
    return `${equipped.catSkin}|${equipped.board}|${equipped.effect}`;
  }

  private showDialog(titleText: string, bodyText: string, cancelText: string, confirmText: string,
    onConfirm: () => void, onCancel?: () => void, auxiliary?: { text: string; onTap: () => void },
    presentation?: Pick<DialogActions, 'cancelTone' | 'confirmTone' | 'showClose'>): void {
    if (!this.screenRoot) return;
    this.inputLocked = true;
    this.svc.dialogs.showDialog(this.screenRoot, titleText, bodyText, cancelText, confirmText, {
      onConfirm, onCancel: () => { this.inputLocked = false; onCancel?.(); }, auxiliary, ...presentation,
    });
  }

  private clearScreen(): void {
    this.flow.teardown();
    this.sceneToken += 1;
    this.inputLocked = false;
    this.gamePreparingOverlay.close();
    this.shareInProgress = false;
    this.economyPanels.resetOverlays();
    if (this.screenRoot && this.screenRoot !== this.homeRoot) {
      stopTweens(this.screenRoot); this.screenRoot.destroy();
    }
    this.screenRoot = null;
    if (this.homeRoot?.isValid) { this.svc.homeView.pauseAnimations(); this.homeRoot.active = false; }
  }

  private makeScreen(name: string): Node {
    const root = createUiNode(name, this.uiWidthValue, this.uiHeightValue);
    this.platform.node.addChild(root);
    this.screenRoot = root;
    return root;
  }
}
