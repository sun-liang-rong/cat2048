import {
  _decorator,
  Component,
  EventKeyboard,
  input,
  Input,
  KeyCode,
  Node,
  ResolutionPolicy,
  screen,
  sys,
  Tween,
  UITransform,
  view,
} from 'cc';
import {
  LocalEconomyRepository,
  type EconomyMutationResult,
  type EconomySnapshot,
} from '../../features/economy/economy';
import { LocalDailyTaskRepository } from '../../features/tasks/dailyTasks';
import { RunSessionStore, type SavedRunMode } from '../../features/storage/runSession';
import type { Direction } from '../../core/types';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { HapticController } from '../../infrastructure/HapticController';
import { ResultShareController } from '../../infrastructure/ResultShareController';
import type { SharePurpose, ShareResult } from '../../infrastructure/ResultShareController';
import { runtimeStorage } from '../../features/storage/runtime';
import {
  createWechatLeaderboardClient,
  highestLevelOfTiles,
} from '../../features/leaderboard/leaderboard';
import { DEFAULT_SAVE } from '../../features/storage/storage';
import type { SaveDataV3 } from '../../features/storage/storage';
import { ArtRepository } from '../utils/ArtRepository';
import { AudioController } from '../components/AudioController';
import { safeInsetsFromRect } from '../styles/layout';
import { ModalView, type DialogActions } from '../panels/ModalView';
import { CollectionView } from './CollectionView';
import { HomeView, type HomeViewModel } from './HomeView';
import { LoadingView } from './LoadingView';
import { LeaderboardView } from './LeaderboardView';
import { CosmeticRuntime } from '../components/CosmeticRuntime';
import { DailyRewardView } from '../panels/DailyRewardView';
import { TaskPanelView } from '../panels/TaskPanelView';
import { ShopView } from './ShopView';
import { SettingsPanel } from '../panels/SettingsPanel';
import { settingsOrigin } from '../utils/settingsNavigation';
import { EconomyPanelsController, type ScreenName } from '../controllers/EconomyPanelsController';
import { LeaderboardController } from '../controllers/LeaderboardController';
import type { CollectionOrigin } from './CollectionView';
import { runStartupSequence } from '../utils/startupSequence';
import { markCocosLoadingReady } from '../utils/cocosLoadingBridge';
import { GameFlowController } from './GameFlowController';
import type { GameFlowHost } from './GameFlowController';
import {
  createUiNode,
  setRuntimeFonts,
} from '../utils/uiFactory';
import { economyErrorText } from '../../features/economy/errors';
import { cosmeticAssetPaths, collectionAssetPaths } from '../utils/assetPaths';
import { wechatCapsuleInset } from '../utils/safeInsets';
import { stopTweens } from '../utils/tweenAsync';

const { ccclass } = _decorator;

@ccclass('Cat2048Boot')
export class Cat2048Boot extends Component implements GameFlowHost {
  private readonly art = new ArtRepository();
  private readonly cosmetics = new CosmeticRuntime(this.art);
  private readonly homeView = new HomeView(this.art);
  private readonly collectionView = new CollectionView(this.art, this.cosmetics);
  private readonly leaderboardView = new LeaderboardView(this.art);
  private readonly shopView = new ShopView(this.art, this.cosmetics);
  private readonly dailyRewardView = new DailyRewardView(this.art);
  private readonly taskPanel = new TaskPanelView(this.art);
  private readonly loadingView = new LoadingView();
  private readonly haptics = new HapticController();
  private readonly resultShare = new ResultShareController();
  private readonly economy = new LocalEconomyRepository(sys.localStorage);
  private readonly tasks = new LocalDailyTaskRepository(sys.localStorage);
  private readonly runSession = new RunSessionStore(sys.localStorage);
  private readonly leaderboard = createWechatLeaderboardClient(
    GAME_CONFIG.network.leaderboardBaseUrl,
    sys.localStorage,
  );
  private flow!: GameFlowController;
  private audio!: AudioController;
  private save: SaveDataV3 = DEFAULT_SAVE;
  private screenRoot: Node | null = null;
  private economySnapshot!: EconomySnapshot;
  private inputLocked = false;
  private readonly dialogs = new ModalView(this.art, () => ({ width: this.uiWidth, height: this.uiHeight }));
  private readonly settings = new SettingsPanel(() => ({ width: this.uiWidth, height: this.uiHeight }), this.art);
  private readonly economyPanels = new EconomyPanelsController({
    art: this.art,
    cosmetics: this.cosmetics,
    economy: this.economy,
    tasks: this.tasks,
    dialogs: this.dialogs,
    dailyRewardView: this.dailyRewardView,
    taskPanel: this.taskPanel,
    shopView: this.shopView,
    collectionView: this.collectionView,
    getScreenRoot: () => this.screenRoot,
    getCurrentScreen: () => this.currentScreen,
    getSceneToken: () => this.sceneToken,
    getSave: () => this.save,
    getEconomySnapshot: () => this.economySnapshot,
    getSize: () => ({ width: this.uiWidth, height: this.uiHeight }),
    topInset: () => this.topSafeInset(),
    bottomInset: () => this.bottomSafeInset(),
    isInputLocked: () => this.inputLocked,
    lockInput: () => { this.inputLocked = true; },
    unlockInput: () => { this.inputLocked = false; },
    applyEconomyResult: (result) => this.applyEconomyResult(result),
    applyEconomySnapshot: (snapshot) => this.applyEconomySnapshot(snapshot),
    showNotice: (text) => this.showNotice(text),
    showHome: () => this.showHome(),
    showGame: (resume, mode) => this.showGame(resume, mode),
    makeScreen: (name) => this.makeScreen(name),
    clearScreen: () => this.clearScreen(),
    setCurrentScreen: (name) => { this.currentScreen = name; },
  });
  private uiWidth: number = GAME_CONFIG.designWidth;
  private uiHeight: number = GAME_CONFIG.designHeight;
  private safeTop = 24;
  private safeBottom = 20;
  private sceneToken = 0;
  private shareInProgress = false;
  private assetsReady = false;
  private currentScreen: ScreenName = 'loading';
  private homeRoot: Node | null = null;
  private readonly leaderboardCtrl = new LeaderboardController({
    leaderboard: this.leaderboard,
    leaderboardView: this.leaderboardView,
    getSave: () => this.save,
    getSize: () => ({ width: this.uiWidth, height: this.uiHeight }),
    topInset: () => this.topSafeInset(),
    bottomInset: () => this.bottomSafeInset(),
    getCurrentScreen: () => this.currentScreen,
    getSceneToken: () => this.sceneToken,
    showHome: () => this.showHome(),
    makeScreen: (name) => this.makeScreen(name),
    clearScreen: () => this.clearScreen(),
    setCurrentScreen: (name) => { this.currentScreen = name; },
  });

  protected override onLoad(): void {
    this.setupCanvas();
    this.save = runtimeStorage.load();
    this.cosmetics.setEquipped(this.save.economy.equipped);
    this.audio = new AudioController(this.node, this.art);
    this.audio.enabled = this.save.soundEnabled;
    this.audio.musicEnabled = this.save.musicEnabled;
    this.haptics.enabled = this.save.hapticsEnabled;
    this.flow = new GameFlowController({
      art: this.art,
      cosmetics: this.cosmetics,
      audio: this.audio,
      haptics: this.haptics,
      leaderboard: this.leaderboard,
      economy: this.economy,
      tasks: this.tasks,
      runSession: this.runSession,
      host: this,
      actions: {
        onBack: () => this.confirmLeave(),
        onSettings: () => this.showSettingsDialog(),
        onCollection: () => this.economyPanels.showCollection('game'),
        onHome: () => this.showHome(),
        onReplay: () => this.showGame(true, this.flow.mode),
      },
    });
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    screen.on('window-resize', this.onResize, this);
    screen.on('orientation-change', this.onResize, this);
    void this.initialize();
  }

  protected override onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    screen.off('window-resize', this.onResize, this);
    screen.off('orientation-change', this.onResize, this);
    Tween.stopAll();
    this.sceneToken += 1;
  }

  // ---- GameFlowHost 实现：对局流程所需的页面能力 ----

  public isOnGameScreen(): boolean {
    return this.currentScreen === 'game';
  }

  public isInputLocked(): boolean {
    return this.inputLocked;
  }

  public lockInput(): void {
    this.inputLocked = true;
  }

  public unlockInput(): void {
    this.inputLocked = false;
  }

  public getSave(): SaveDataV3 {
    return this.save;
  }

  public commitSave(save: SaveDataV3): void {
    this.save = save;
    runtimeStorage.save(save);
  }

  public getCoins(): number {
    return this.economySnapshot.coins;
  }

  public applyEconomyResult(result: EconomyMutationResult): void {
    this.applyEconomySnapshot(result);
  }

  public showNotice(text: string): void {
    this.dialogs.showNotice(this.screenRoot, text, this.currentScreen === 'game'
      ? { anchor: 'top', offset: this.topSafeInset() + 186 }
      : undefined);
  }

  public async requestShare(purpose: SharePurpose): Promise<ShareResult | null> {
    if (this.shareInProgress || !this.screenRoot) return null;
    const shareRoot = this.screenRoot;
    const token = this.sceneToken;
    const highestLevel = highestLevelOfTiles(this.flow.board.tiles);
    const cat = GAME_CONFIG.cats[highestLevel - 1];
    let backgroundPath: string | undefined;
    let catPath: string | undefined;
    try {
      [backgroundPath, catPath] = await Promise.all([
        this.art.loadShareImagePath(GAME_CONFIG.art.shareScoreBackground),
        this.art.loadShareImagePath(cat.asset),
      ]);
    } catch (error) {
      console.warn('[Cat2048] Failed to load share card images.', error);
    }
    if (!backgroundPath || !catPath) {
      this.dialogs.showNotice(this.screenRoot, '分享卡片素材暂不可用');
      return 'failed';
    }

    this.shareInProgress = true;
    const result = this.resultShare.share({
      purpose,
      score: this.flow.score,
      bestScore: this.save.highScore,
      catLevel: highestLevel,
      catName: cat.name,
      backgroundPath,
      catPath,
    });
    return result.then((shared) => {
      this.shareInProgress = false;
      if (token !== this.sceneToken || this.screenRoot !== shareRoot) return null;
      if (shared === 'shared') {
        this.tasks.recordEvent('share-once');
        return shared;
      }
      this.dialogs.showNotice(shareRoot, shared === 'unsupported'
        ? '请在微信小游戏中分享给好友或群'
        : '分享卡片生成失败，请稍后重试');
      return shared;
    });
  }

  // ---- 生命周期与画布 ----

  private async initialize(): Promise<void> {
    this.showLoading();
    // The Cocos first screen should hand off to this page before remote assets load.
    markCocosLoadingReady();
    this.applyEconomySnapshot(await this.economy.load());
    await runStartupSequence({
      preload: () => this.art.preload(this.save.economy.equipped, (ratio) => this.loadingView.setProgress(ratio)),
      isActive: () => this.isValid,
      onReady: () => {
        this.assetsReady = true;
        setRuntimeFonts(
          this.art.font(GAME_CONFIG.fonts.display) ?? null,
          null,
        );
        this.audio.playMusic();
        this.showHome();
        void this.leaderboardCtrl.authenticate();
        void this.leaderboardCtrl.flushPendingScores();
      },
      onError: (error) => {
        console.error('[Cat2048] Startup asset loading failed', error);
        this.loadingView.showError();
      },
    });
  }

  private setupCanvas(): void {
    view.setDesignResolutionSize(GAME_CONFIG.designWidth, GAME_CONFIG.designHeight, ResolutionPolicy.FIXED_WIDTH);
    const visible = view.getVisibleSize();
    this.uiWidth = visible.width;
    this.uiHeight = visible.height;
    const safe = safeInsetsFromRect(this.uiHeight, sys.getSafeAreaRect(false));
    this.safeTop = Math.max(safe.top, wechatCapsuleInset(this.uiWidth));
    this.safeBottom = safe.bottom;
    (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform)).setContentSize(visible);
  }

  private readonly onResize = (): void => {
    this.unschedule(this.applyResize);
    this.scheduleOnce(this.applyResize, 0.15);
  };

  private readonly applyResize = (): void => {
    const screenBeforeResize = this.currentScreen;
    this.setupCanvas();
    if (!this.assetsReady) {
      this.showLoading();
      return;
    }
    if (screenBeforeResize === 'game') this.showGame(false);
    else if (screenBeforeResize === 'collection') this.economyPanels.showCollection(this.economyPanels.lastCollectionOrigin);
    else if (screenBeforeResize === 'shop') this.economyPanels.showShop();
    else if (screenBeforeResize === 'leaderboard') this.leaderboardCtrl.showLeaderboard();
    else {
      if (this.homeRoot?.isValid) {
        stopTweens(this.homeRoot);
        this.homeView.destroy();
        this.homeRoot.destroy();
        this.homeRoot = null;
      }
      this.showHome();
    }
  };

  // ---- 页面导航 ----

  private showLoading(): void {
    this.clearScreen();
    this.currentScreen = 'loading';
    const root = this.makeScreen('Loading');
    this.loadingView.build(root, this.uiWidth, this.uiHeight);
  }

  private homeViewModel(): HomeViewModel {
    const pending = this.runSession.load();
    return {
      highScore: this.save.highScore,
      collectionCount: this.save.unlockedCatLevels.length,
      coins: this.economySnapshot.coins,
      canClaimDaily: this.economySnapshot.canClaimDaily,
      dailyReward: this.economySnapshot.dailyReward,
      taskClaimable: this.tasks.snapshot().canClaim,
      soundEnabled: this.save.soundEnabled,
      hasPendingRun: !!pending,
      pendingRunScore: pending?.score ?? 0,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    };
  }

  private showHome(): void {
    this.clearScreen();
    this.currentScreen = 'home';
    if (this.homeRoot?.isValid) {
      this.homeRoot.active = true;
      this.screenRoot = this.homeRoot;
      this.homeView.refresh(this.homeViewModel());
      this.homeView.resumeAnimations();
      return;
    }
    const root = this.makeScreen('Home');
    this.homeRoot = root;
    this.homeView.build(root, this.homeViewModel(), {
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

  private toggleSound(): void {
    this.save = { ...this.save, soundEnabled: !this.save.soundEnabled };
    runtimeStorage.save(this.save);
    this.audio.enabled = this.save.soundEnabled;
    this.homeView.setSoundEnabled(this.save.soundEnabled);
  }

  private startGame(): void {
    const pending = this.runSession.load();
    if (pending) {
      this.flow.resumeRun(pending);
      this.showGame(false);
      return;
    }
    this.showGame(true, 'classic');
  }

  private restartGame(): void {
    this.runSession.clear();
    this.showGame(true, 'classic');
  }

  private startDailyChallenge(): void {
    this.runSession.clear();
    this.showGame(true, 'daily-challenge');
  }



  private showGame(startNewGame: boolean, mode: SavedRunMode = this.flow.mode): void {
    this.clearScreen();
    this.currentScreen = 'game';
    if (startNewGame) this.flow.startRun(mode);
    const root = this.makeScreen('Game');
    this.flow.buildGameScreen(root, {
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
      score: this.flow.score,
      highScore: this.save.highScore,
      moves: this.flow.moves,
      merges: this.flow.merges,
      board: this.flow.board,
      items: this.flow.items,
      unlockedCount: this.save.unlockedCatLevels.length,
    });
  }

  // ---- 输入 ----

  private readonly onKeyDown = (event: EventKeyboard): void => {
    if (!this.flow.isBoardActive() || this.inputLocked) return;
    const directions: Partial<Record<KeyCode, Direction>> = {
      [KeyCode.ARROW_UP]: 'up', [KeyCode.ARROW_DOWN]: 'down',
      [KeyCode.ARROW_LEFT]: 'left', [KeyCode.ARROW_RIGHT]: 'right',
      [KeyCode.KEY_W]: 'up', [KeyCode.KEY_S]: 'down', [KeyCode.KEY_A]: 'left', [KeyCode.KEY_D]: 'right',
    };
    const direction = directions[event.keyCode];
    if (direction) void this.flow.performMove(direction);
  };

  // ---- 弹窗与设置 ----

  private applyEconomySnapshot(snapshot: EconomySnapshot): void {
    this.economySnapshot = snapshot;
    this.save = {
      ...runtimeStorage.load(),
      economy: {
        coins: snapshot.coins,
        ownedItemIds: snapshot.ownedItemIds,
        equipped: snapshot.equipped,
        lastDailyClaimDate: snapshot.lastDailyClaimDate,
        dailyStreak: snapshot.dailyStreak,
        settledRunIds: snapshot.settledRunIds,
        undoItems: snapshot.undoItems,
        removeLowestItems: snapshot.removeLowestItems,
      },
    };
    this.cosmetics.setEquipped(this.save.economy.equipped);
  }

  private confirmLeave(): void {
    this.showDialog('返回主页？', '本局会自动保存，下次可继续冒险。', '继续游戏', '返回主页',
      () => this.showHome(), undefined, undefined, { cancelTone: 'primary', confirmTone: 'secondary' });
  }

  private showInfoDialog(): void {
    this.showDialog('怎么玩', '滑动屏幕或使用方向键\n合并两只相同猫咪并不断升级', '知道啦', '开始游戏',
      () => this.startGame());
  }

  private showSettingsDialog(): void {
    if (!this.screenRoot) return;
    const origin = settingsOrigin(this.flow.isBoardActive());
    this.inputLocked = true;
    this.settings.show(this.screenRoot, {
      soundEnabled: this.save.soundEnabled,
      musicEnabled: this.save.musicEnabled,
      hapticsEnabled: this.save.hapticsEnabled,
    }, {
      onSoundChange: (enabled) => {
        this.save = { ...this.save, soundEnabled: enabled };
        this.audio.enabled = enabled;
        runtimeStorage.save(this.save);
      },
      onMusicChange: (enabled) => {
        this.save = { ...this.save, musicEnabled: enabled };
        this.audio.setMusicEnabled(enabled);
        runtimeStorage.save(this.save);
      },
      onHapticsChange: (enabled) => {
        this.save = { ...this.save, hapticsEnabled: enabled };
        this.haptics.enabled = enabled;
        runtimeStorage.save(this.save);
      },
      onClose: () => {
        this.inputLocked = false;
        if (origin === 'home') this.showHome();
      },
    });
  }

  private showDialog(titleText: string, bodyText: string, cancelText: string, confirmText: string,
    onConfirm: () => void, onCancel?: () => void, auxiliary?: { text: string; onTap: () => void },
    presentation?: Pick<DialogActions, 'cancelTone' | 'confirmTone' | 'showClose'>): void {
    if (!this.screenRoot) return;
    this.inputLocked = true;
    this.dialogs.showDialog(this.screenRoot, titleText, bodyText, cancelText, confirmText, {
      onConfirm,
      onCancel: () => {
        this.inputLocked = false;
        onCancel?.();
      },
      auxiliary,
      ...presentation,
    });
  }

  // ---- 屏幕容器 ----

  private clearScreen(): void {
    this.flow.teardown();
    this.sceneToken += 1;
    this.inputLocked = false;
    this.shareInProgress = false;
    this.economyPanels.resetOverlays();
    this.shopView.clear();
    this.leaderboardView.clear();
    if (this.screenRoot && this.screenRoot !== this.homeRoot) {
      stopTweens(this.screenRoot);
      this.screenRoot.destroy();
    }
    this.screenRoot = null;
    if (this.homeRoot?.isValid) {
      this.homeView.pauseAnimations();
      this.homeRoot.active = false;
    }
  }

  private makeScreen(name: string): Node {
    const root = createUiNode(name, this.uiWidth, this.uiHeight);
    this.node.addChild(root);
    this.screenRoot = root;
    return root;
  }

  private topSafeInset(): number {
    return this.safeTop;
  }

  private bottomSafeInset(): number {
    return this.safeBottom;
  }

}
