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
} from '../economy/economy';
import { LocalDailyTaskRepository } from '../infrastructure/dailyTasks';
import { RunSessionStore, type SavedRunMode } from '../infrastructure/runSession';
import type { Direction } from '../core/types';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import { HapticController } from '../infrastructure/HapticController';
import { ResultShareController } from '../infrastructure/ResultShareController';
import type { SharePurpose, ShareResult } from '../infrastructure/ResultShareController';
import { runtimeStorage } from '../infrastructure/runtime';
import {
  createWechatLeaderboardClient,
  highestLevelOfTiles,
} from '../infrastructure/leaderboard';
import { DEFAULT_SAVE } from '../infrastructure/storage';
import type { SaveDataV3 } from '../infrastructure/storage';
import { ArtRepository } from './ArtRepository';
import { AudioController } from './AudioController';
import {
  capsuleBottomInset,
  safeInsetsFromRect,
} from './layout';
import { DialogView, type DialogActions } from './DialogView';
import { CollectionView } from './CollectionView';
import type { CollectionOrigin } from './CollectionView';
import { HomeView, type HomeViewModel } from './HomeView';
import { LoadingView } from './LoadingView';
import { LeaderboardView } from './LeaderboardView';
import { CosmeticRuntime } from './CosmeticRuntime';
import { DailyRewardView } from './DailyRewardView';
import { TaskPanelView } from './TaskPanelView';
import { ShopView } from './ShopView';
import { SettingsPanel } from './SettingsPanel';
import { settingsOrigin } from './settingsNavigation';
import { runStartupSequence } from './startupSequence';
import { markCocosLoadingReady } from './cocosLoadingBridge';
import { GameFlowController } from './GameFlowController';
import type { GameFlowHost } from './GameFlowController';
import {
  createUiNode,
  setButtonTheme,
  setRuntimeFonts,
} from './uiFactory';

const { ccclass } = _decorator;

type ScreenName = 'loading' | 'home' | 'game' | 'collection' | 'shop' | 'leaderboard';

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
  private dailyRewardOverlay: Node | null = null;
  private taskOverlay: Node | null = null;
  private taskClaimInProgress = false;
  private economySnapshot!: EconomySnapshot;
  private inputLocked = false;
  private readonly dialogs = new DialogView(this.art, () => ({ width: this.uiWidth, height: this.uiHeight }));
  private readonly settings = new SettingsPanel(() => ({ width: this.uiWidth, height: this.uiHeight }));
  private uiWidth: number = GAME_CONFIG.designWidth;
  private uiHeight: number = GAME_CONFIG.designHeight;
  private safeTop = 24;
  private safeBottom = 20;
  private sceneToken = 0;
  private shareInProgress = false;
  private assetsReady = false;
  private currentScreen: ScreenName = 'loading';
  private homeRoot: Node | null = null;
  private collectionOrigin: CollectionOrigin = 'home';
  private dailyPromptShown = false;
  private dailyClaimInProgress = false;
  private leaderboardRequestSequence = 0;

  protected override onLoad(): void {
    this.setupCanvas();
    this.save = runtimeStorage.load();
    this.cosmetics.setEquipped(this.save.economy.equipped);
    setButtonTheme(this.cosmetics.buttonTheme());
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
        onCollection: () => this.showCollection('game'),
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
        setButtonTheme(this.cosmetics.buttonTheme());
        this.audio.playMusic();
        this.showHome();
        void this.authenticateLeaderboard();
        void this.flushPendingLeaderboardScores();
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
    this.safeTop = Math.max(safe.top, this.wechatCapsuleInset());
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
    else if (screenBeforeResize === 'collection') this.showCollection(this.collectionOrigin);
    else if (screenBeforeResize === 'shop') this.showShop();
    else if (screenBeforeResize === 'leaderboard') this.showLeaderboard();
    else {
      if (this.homeRoot?.isValid) {
        this.stopTweens(this.homeRoot);
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
      onCollection: () => { if (this.assetsReady) this.showCollection('home'); },
      onLeaderboard: () => { if (this.assetsReady) this.showLeaderboard(); },
      onShop: () => { if (this.assetsReady) this.showShop(); },
      onDailyReward: () => { if (this.assetsReady) this.showDailyReward(); },
      onTasks: () => { if (this.assetsReady) this.showTasks(); },
      onToggleSound: () => { if (this.assetsReady) this.toggleSound(); },
      onSettings: () => { if (this.assetsReady) this.showSettingsDialog(); },
    });
    if (this.economySnapshot.canClaimDaily && !this.dailyPromptShown) {
      this.dailyPromptShown = true;
      this.showDailyReward();
    }
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

  private showLeaderboard(): void {
    this.clearScreen();
    this.currentScreen = 'leaderboard';
    const root = this.makeScreen('Leaderboard');
    this.leaderboardView.build(root, {
      data: null,
      status: 'loading',
      localHighScore: this.save.highScore,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    }, {
      onBack: () => this.showHome(),
      onRetry: () => { void this.loadLeaderboard(); },
    });
    void this.loadLeaderboard();
  }

  private async loadLeaderboard(): Promise<void> {
    if (this.currentScreen !== 'leaderboard') return;
    const token = this.sceneToken;
    const requestSequence = ++this.leaderboardRequestSequence;
    this.leaderboardView.update({
      data: null,
      status: 'loading',
      localHighScore: this.save.highScore,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    });
    try {
      const data = await this.leaderboard.getLeaderboard();
      if (token !== this.sceneToken
        || requestSequence !== this.leaderboardRequestSequence
        || this.currentScreen !== 'leaderboard') return;
      this.leaderboardView.update({
        data,
        status: 'ready',
        localHighScore: this.save.highScore,
        uiWidth: this.uiWidth,
        uiHeight: this.uiHeight,
        topInset: this.topSafeInset(),
        bottomInset: this.bottomSafeInset(),
      });
    } catch (error) {
      if (token !== this.sceneToken
        || requestSequence !== this.leaderboardRequestSequence
        || this.currentScreen !== 'leaderboard') return;
      console.warn('[Cat2048] Failed to load leaderboard.', error);
      this.leaderboardView.update({
        data: null,
        status: 'error',
        localHighScore: this.save.highScore,
        uiWidth: this.uiWidth,
        uiHeight: this.uiHeight,
        topInset: this.topSafeInset(),
        bottomInset: this.bottomSafeInset(),
      });
    }
  }

  private showShop(): void {
    void this.openShop();
  }

  private async openShop(): Promise<void> {
    const token = this.sceneToken;
    try {
      await this.art.loadFrames(this.cosmeticAssetPaths());
    } catch (error) {
      console.warn('[Cat2048] Failed to load shop assets, showing fallbacks.', error);
    }
    if (token !== this.sceneToken) return;
    this.renderShop();
  }

  private renderShop(): void {
    this.clearScreen();
    this.currentScreen = 'shop';
    const root = this.makeScreen('Shop');
    this.shopView.build(root, {
      economy: this.economySnapshot,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    }, {
      onBack: () => this.showHome(),
      onDailyReward: () => this.showDailyReward(),
      onPurchase: (itemId) => { void this.purchaseCosmetic(itemId); },
      onEquip: (itemId) => { void this.equipCosmetic(itemId); },
    });
  }

  private showDailyReward(): void {
    if (!this.screenRoot || this.dailyRewardOverlay?.isValid) return;
    this.inputLocked = true;
    this.dailyRewardOverlay = this.dailyRewardView.show(this.screenRoot, this.economySnapshot,
      this.uiWidth, this.uiHeight, {
        onClaim: () => { void this.claimDailyReward(); },
        onClose: () => {
          if (this.dailyClaimInProgress) return;
          this.dailyRewardOverlay?.destroy();
          this.dailyRewardOverlay = null;
          this.inputLocked = false;
        },
      });
  }

  private async claimDailyReward(): Promise<void> {
    if (this.dailyClaimInProgress || !this.dailyRewardOverlay?.isValid) return;
    this.dailyClaimInProgress = true;
    try {
      const result = await this.economy.claimDailyReward();
      this.applyEconomyResult(result);
      if (!result.ok) {
        this.inputLocked = false;
        this.dialogs.showNotice(this.screenRoot, '今日奖励已领取');
        return;
      }
      await this.economy.grantItem('undo', 1);
      await this.economy.grantItem('remove-lowest', 1);
      this.applyEconomySnapshot(await this.economy.load());
      this.dailyRewardOverlay?.destroy();
      this.dailyRewardOverlay = null;
      this.inputLocked = false;
      if (this.currentScreen === 'shop') this.showShop();
      else this.showHome();
    } catch (error) {
      console.warn('[Cat2048] Failed to claim daily reward.', error);
      this.inputLocked = false;
      this.dialogs.showNotice(this.screenRoot, '每日奖励领取失败');
    } finally {
      this.dailyClaimInProgress = false;
    }
  }

  private showTasks(): void {
    if (!this.screenRoot || this.taskOverlay?.isValid) return;
    this.inputLocked = true;
    this.taskOverlay = this.taskPanel.show(this.screenRoot, this.tasks.snapshot(),
      this.uiWidth, this.uiHeight, {
        onClaim: (taskId) => { void this.claimTask(taskId); },
        onClose: () => {
          if (this.taskClaimInProgress) return;
          this.taskOverlay?.destroy();
          this.taskOverlay = null;
          this.inputLocked = false;
        },
      });
  }

  private async claimTask(taskId: string): Promise<void> {
    if (this.taskClaimInProgress || !this.taskOverlay?.isValid) return;
    this.taskClaimInProgress = true;
    try {
      const result = this.tasks.claim(taskId);
      if (result.ok) {
        await this.economy.grantCoins(result.awardedCoins);
        this.applyEconomySnapshot(await this.economy.load());
      } else {
        this.dialogs.showNotice(this.screenRoot, '任务尚未完成');
      }
      this.taskPanel.refresh(result.snapshot, {
        onClaim: (id) => { void this.claimTask(id); },
        onClose: () => {
          if (this.taskClaimInProgress) return;
          this.taskOverlay?.destroy();
          this.taskOverlay = null;
          this.inputLocked = false;
        },
      });
    } catch (error) {
      console.warn('[Cat2048] Failed to claim task reward.', error);
      this.dialogs.showNotice(this.screenRoot, '任务奖励领取失败');
    } finally {
      this.taskClaimInProgress = false;
    }
  }

  private async purchaseCosmetic(itemId: string): Promise<void> {
    if (this.inputLocked) return;
    this.inputLocked = true;
    try {
      const result = await this.economy.purchase(itemId);
      this.applyEconomyResult(result);
      this.inputLocked = false;
      if (!result.ok) {
        this.dialogs.showNotice(this.screenRoot, this.economyErrorText(result));
        return;
      }
      this.showShop();
    } catch (error) {
      this.inputLocked = false;
      console.warn('[Cat2048] Failed to purchase cosmetic.', error);
      this.dialogs.showNotice(this.screenRoot, '购买失败，请稍后重试');
    }
  }

  private async equipCosmetic(itemId: string): Promise<void> {
    if (this.inputLocked) return;
    this.inputLocked = true;
    try {
      const result = await this.economy.equip(itemId);
      this.applyEconomyResult(result);
      this.inputLocked = false;
      if (!result.ok) {
        this.dialogs.showNotice(this.screenRoot, '该装饰尚未拥有');
        return;
      }
      this.showShop();
    } catch (error) {
      this.inputLocked = false;
      console.warn('[Cat2048] Failed to equip cosmetic.', error);
      this.dialogs.showNotice(this.screenRoot, '装备失败，请稍后重试');
    }
  }

  private showCollection(origin: CollectionOrigin): void {
    void this.openCollection(origin);
  }

  private async openCollection(origin: CollectionOrigin): Promise<void> {
    const token = this.sceneToken;
    try {
      await this.art.loadFrames([...this.cosmeticAssetPaths(), ...this.collectionAssetPaths()]);
    } catch (error) {
      console.warn('[Cat2048] Failed to load collection assets, showing fallbacks.', error);
    }
    if (token !== this.sceneToken) return;
    this.renderCollection(origin);
  }

  private renderCollection(origin: CollectionOrigin): void {
    this.clearScreen();
    this.currentScreen = 'collection';
    this.collectionOrigin = origin;
    const root = this.makeScreen('Collection');
    this.collectionView.build(root, {
      unlockedLevels: this.save.unlockedCatLevels,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    }, {
      onBack: () => {
        if (origin === 'game') this.showGame(false);
        else this.showHome();
      },
    });
  }

  private cosmeticAssetPaths(): string[] {
    const paths = new Set<string>();
    for (const item of this.economySnapshot.catalog) {
      if (item.previewAsset) paths.add(item.previewAsset);
      if (item.levelAssets) for (const path of item.levelAssets) paths.add(path);
      if (item.boardAsset) paths.add(item.boardAsset);
      if (item.sparkleAsset) paths.add(item.sparkleAsset);
      if (item.burstAsset) paths.add(item.burstAsset);
      if (item.primaryAsset) paths.add(item.primaryAsset);
      if (item.secondaryAsset) paths.add(item.secondaryAsset);
      if (item.rewardAsset) paths.add(item.rewardAsset);
      if (item.creamAsset) paths.add(item.creamAsset);
    }
    return Array.from(paths);
  }

  private collectionAssetPaths(): string[] {
    const art = GAME_CONFIG.art;
    return [
      art.collectionBackground,
      art.collectionCardLight,
      art.collectionCardLocked,
      art.collectionBackPaw,
      art.collectionLockedCat,
      art.collectionLock,
    ];
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
    setButtonTheme(this.cosmetics.buttonTheme());
  }

  private economyErrorText(result: EconomyMutationResult): string {
    if (result.reason === 'insufficient-coins') return '金币不足';
    if (result.reason === 'already-owned') return '该装饰已拥有';
    return '装饰操作失败';
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
    this.dialogs.show(this.screenRoot, titleText, bodyText, cancelText, confirmText, {
      onConfirm,
      onCancel: () => {
        this.inputLocked = false;
        onCancel?.();
      },
      auxiliary,
      ...presentation,
    });
  }

  // ---- 排行榜后台任务 ----

  private async flushPendingLeaderboardScores(): Promise<void> {
    try {
      await this.leaderboard.flushPendingScores();
    } catch (error) {
      console.warn('[Cat2048] Failed to flush pending leaderboard scores.', error);
    }
  }

  private async authenticateLeaderboard(): Promise<void> {
    try {
      await this.leaderboard.ensureAuthenticated();
    } catch (error) {
      console.warn('[Cat2048] Leaderboard authentication unavailable.', error);
    }
  }

  // ---- 屏幕容器 ----

  private clearScreen(): void {
    this.flow.teardown();
    this.sceneToken += 1;
    this.inputLocked = false;
    this.shareInProgress = false;
    this.dailyRewardOverlay = null;
    this.shopView.clear();
    this.leaderboardView.clear();
    if (this.screenRoot && this.screenRoot !== this.homeRoot) {
      this.stopTweens(this.screenRoot);
      this.screenRoot.destroy();
    }
    this.screenRoot = null;
    if (this.homeRoot?.isValid) {
      this.homeView.pauseAnimations();
      this.homeRoot.active = false;
    }
  }

  private stopTweens(root: Node): void {
    const queue: Node[] = [root];
    while (queue.length > 0) {
      const node = queue.pop();
      if (!node?.isValid) continue;
      Tween.stopAllByTarget(node);
      queue.push(...node.children);
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

  private wechatCapsuleInset(): number {
    const runtime = globalThis as unknown as {
      wx?: {
        getSystemInfoSync?: () => { windowWidth?: number };
        getMenuButtonBoundingClientRect?: () => { bottom?: number };
      };
    };
    try {
      return capsuleBottomInset(this.uiWidth, runtime.wx?.getSystemInfoSync?.(),
        runtime.wx?.getMenuButtonBoundingClientRect?.());
    } catch (error) {
      console.warn('[Cat2048] Unable to read the WeChat menu capsule bounds.', error);
      return 0;
    }
  }
}
