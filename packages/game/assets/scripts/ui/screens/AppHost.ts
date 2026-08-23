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
import { settingsOrigin } from '../utils/settingsNavigation';
import { EconomyPanelsController, type ScreenName } from '../controllers/EconomyPanelsController';
import { LeaderboardController } from '../controllers/LeaderboardController';
import { GameFlowController } from './GameFlowController';
import type { GameFlowHost } from './GameFlowController';
import { createUiNode, setRuntimeFonts } from '../utils/uiFactory';
import { stopTweens, tweenOpacity } from '../utils/tweenAsync';

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
  private assetsReady = false;
  private homeTransitionToken = 0;
  private sceneToken = 0;
  private currentScreen: ScreenName = 'loading';

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
      tasks: svc.tasks,
      runSession: svc.runSession,
      host: this,
      actions: {
        onBack: () => this.confirmLeave(),
        onSettings: () => this.showSettingsDialog(),
        onCollection: () => this.economyPanels.showCollection('game'),
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
    this.homeTransitionToken += 1;
    this.svc.loadingView.reset();
    this.showLoading();
    try {
      this.applyEconomySnapshot(await this.svc.economy.load());
    } catch (error) {
      console.error('[Cat2048] Startup data loading failed', error);
      this.svc.loadingView.showError();
      return;
    }
    const { runStartupSequence } = await import('../utils/startupSequence');
    await runStartupSequence({
      preload: () => this.svc.art.preload(
        this.saveValue.economy.equipped,
        (ratio) => this.svc.loadingView.setProgress(ratio),
      ),
      isActive: () => this.platform.isValid,
      onReady: () => {
        this.assetsReady = true;
        this.beginHomeTransition();
      },
      onError: (error) => {
        console.error('[Cat2048] Startup asset loading failed', error);
        this.svc.loadingView.showError();
      },
    });
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
      onPlay: () => { if (this.assetsReady) this.startGame(); },
      onRestart: () => { if (this.assetsReady) this.restartGame(); },
      onDailyChallenge: () => { if (this.assetsReady) this.startDailyChallenge(); },
      onInfo: () => { if (this.assetsReady) this.showInfoDialog(); },
      onCollection: () => { if (this.assetsReady) this.economyPanels.showCollection('home'); },
      onLeaderboard: () => { if (this.assetsReady) this.leaderboardCtrl.showLeaderboard(); },
      onShop: () => { if (this.assetsReady) this.economyPanels.showShop(); },
      onDailyReward: () => { if (this.assetsReady) this.economyPanels.showDailyReward(); },
      onTasks: () => { if (this.assetsReady) this.economyPanels.showTasks(); },
      onToggleSound: () => { if (this.assetsReady) this.toggleSound(); },
      onSettings: () => { if (this.assetsReady) this.showSettingsDialog(); },
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

  public showInfoDialog(): void {
    this.showDialog('怎么玩', '滑动屏幕或使用方向键\n合并两只相同猫咪并不断升级', '知道啦', '开始游戏',
      () => this.startGame());
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
    this.shareInProgress = false;
    this.economyPanels.resetOverlays();
    this.flow.teardown();
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
    this.economySnapshotValue = snapshot;
    this.saveValue = {
      ...runtimeStorage.load(),
      economy: {
        coins: snapshot.coins, ownedItemIds: snapshot.ownedItemIds, equipped: snapshot.equipped,
        lastDailyClaimDate: snapshot.lastDailyClaimDate, dailyStreak: snapshot.dailyStreak,
        settledRunIds: snapshot.settledRunIds,
        undoItems: snapshot.undoItems, spawnItems: snapshot.spawnItems,
        shuffleItems: snapshot.shuffleItems, eraseItems: snapshot.eraseItems,
        dailyAdUndo: snapshot.dailyAdUndo, dailyAdSpawn: snapshot.dailyAdSpawn,
        dailyAdShuffle: snapshot.dailyAdShuffle, dailyAdErase: snapshot.dailyAdErase,
        dailyLoginClaimed: snapshot.dailyLoginClaimed, dailyShareUndo: snapshot.dailyShareUndo,
      },
    };
    this.svc.cosmetics.setEquipped(this.saveValue.economy.equipped);
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