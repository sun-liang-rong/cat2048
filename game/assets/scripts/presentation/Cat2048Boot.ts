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
import { Game2048 } from '../core/Game2048';
import type { BoardSnapshot, Direction, ItemKind } from '../core/types';
import {
  LocalEconomyRepository,
  type EconomyMutationResult,
  type EconomySnapshot,
} from '../economy/economy';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import { HapticController } from '../infrastructure/HapticController';
import { ResultShareController } from '../infrastructure/ResultShareController';
import type { SharePurpose, ShareResult } from '../infrastructure/ResultShareController';
import { RuntimeRandomSource, runtimeStorage } from '../infrastructure/runtime';
import {
  createWechatLeaderboardClient,
  highestLevelOfTiles,
  type ScorePayload,
} from '../infrastructure/leaderboard';
import { DEFAULT_SAVE } from '../infrastructure/storage';
import type { SaveDataV3 } from '../infrastructure/storage';
import { ArtRepository } from './ArtRepository';
import { AudioController } from './AudioController';
import { BoardView } from './BoardView';
import {
  capsuleBottomInset,
  safeInsetsFromRect,
} from './layout';
import { DialogView } from './DialogView';
import { CollectionView } from './CollectionView';
import type { CollectionOrigin } from './CollectionView';
import { EvolutionPanelView } from './EvolutionPanelView';
import { GameOverDialogView } from './GameOverDialogView';
import { GameScreen } from './GameScreen';
import { HomeView } from './HomeView';
import { ItemBarView } from './ItemBarView';
import { LoadingView } from './LoadingView';
import { LeaderboardView } from './LeaderboardView';
import { CosmeticRuntime } from './CosmeticRuntime';
import { DailyRewardView } from './DailyRewardView';
import { ShopView } from './ShopView';
import { SettingsPanel } from './SettingsPanel';
import { settingsOrigin } from './settingsNavigation';
import { runStartupSequence } from './startupSequence';
import { SwipeInput } from './SwipeInput';
import { TutorialView } from './TutorialView';
import { markCocosLoadingReady } from './cocosLoadingBridge';
import {
  createUiNode,
  setButtonTheme,
  setRuntimeFonts,
} from './uiFactory';

const { ccclass } = _decorator;

type ScreenName = 'loading' | 'home' | 'game' | 'collection' | 'shop' | 'leaderboard';

@ccclass('Cat2048Boot')
export class Cat2048Boot extends Component {
  private readonly art = new ArtRepository();
  private readonly cosmetics = new CosmeticRuntime(this.art);
  private readonly boardView = new BoardView(this.art, this.cosmetics);
  private readonly homeView = new HomeView(this.art);
  private readonly collectionView = new CollectionView(this.art, this.cosmetics);
  private readonly leaderboardView = new LeaderboardView(this.art);
  private readonly shopView = new ShopView(this.art, this.cosmetics);
  private readonly dailyRewardView = new DailyRewardView(this.art);
  private readonly itemBar = new ItemBarView(this.art);
  private readonly evolutionPanel = new EvolutionPanelView(this.art, this.cosmetics);
  private readonly gameScreen = new GameScreen(this.art, this.boardView, this.itemBar, this.evolutionPanel);
  private readonly tutorialView = new TutorialView();
  private readonly gameOverDialog = new GameOverDialogView(this.art);
  private readonly loadingView = new LoadingView();
  private readonly game = new Game2048(new RuntimeRandomSource());
  private readonly haptics = new HapticController();
  private readonly resultShare = new ResultShareController();
  private readonly economy = new LocalEconomyRepository(sys.localStorage);
  private readonly leaderboard = createWechatLeaderboardClient(
    GAME_CONFIG.network.leaderboardBaseUrl,
    sys.localStorage,
  );
  private audio!: AudioController;
  private save: SaveDataV3 = DEFAULT_SAVE;
  private screenRoot: Node | null = null;
  private gameOverOverlay: Node | null = null;
  private dailyRewardOverlay: Node | null = null;
  private economySnapshot!: EconomySnapshot;
  private inputLocked = false;
  private swipe: SwipeInput | null = null;
  private readonly dialogs = new DialogView(this.art, () => ({ width: this.uiWidth, height: this.uiHeight }));
  private readonly settings = new SettingsPanel(this.art, () => ({ width: this.uiWidth, height: this.uiHeight }));
  private uiWidth: number = GAME_CONFIG.designWidth;
  private uiHeight: number = GAME_CONFIG.designHeight;
  private safeTop = 24;
  private safeBottom = 20;
  private sceneToken = 0;
  private shareInProgress = false;
  private swipeGuideActive = false;
  private assetsReady = false;
  private currentScreen: ScreenName = 'loading';
  private collectionOrigin: CollectionOrigin = 'home';
  private dailyPromptShown = false;
  private dailyClaimInProgress = false;
  private gameOverSettlementInProgress = false;
  private runSequence = 0;
  private currentRunId = '';
  private leaderboardRequestSequence = 0;
  private leaderboardProfileSyncStarted = false;

  protected override onLoad(): void {
    this.setupCanvas();
    this.save = runtimeStorage.load();
    this.cosmetics.setEquipped(this.save.economy.equipped);
    setButtonTheme(this.cosmetics.buttonTheme());
    this.audio = new AudioController(this.node, this.art);
    this.audio.enabled = this.save.soundEnabled;
    this.haptics.enabled = this.save.hapticsEnabled;
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

  private async initialize(): Promise<void> {
    this.showLoading();
    // The Cocos first screen should hand off to this page before remote assets load.
    markCocosLoadingReady();
    this.applyEconomySnapshot(await this.economy.load());
    await runStartupSequence({
      preload: () => this.art.preload((ratio) => this.loadingView.setProgress(ratio)),
      isActive: () => this.isValid,
      onReady: () => {
        this.assetsReady = true;
        setRuntimeFonts(
          this.art.font(GAME_CONFIG.fonts.display) ?? null,
          null,
        );
        setButtonTheme(this.cosmetics.buttonTheme());
        this.showHome();
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
    else this.showHome();
  };

  private showLoading(): void {
    this.clearScreen();
    this.currentScreen = 'loading';
    const root = this.makeScreen('Loading');
    this.loadingView.build(root, this.uiWidth, this.uiHeight);
  }

  private showHome(): void {
    this.clearScreen();
    this.currentScreen = 'home';
    const root = this.makeScreen('Home');
    this.homeView.build(root, {
      highScore: this.save.highScore,
      collectionCount: this.save.unlockedCatLevels.length,
      coins: this.economySnapshot.coins,
      canClaimDaily: this.economySnapshot.canClaimDaily,
      dailyReward: this.economySnapshot.dailyReward,
      soundEnabled: this.save.soundEnabled,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    }, {
      onPlay: () => { if (this.assetsReady) this.startGame(); },
      onInfo: () => { if (this.assetsReady) this.showInfoDialog(); },
      onCollection: () => { if (this.assetsReady) this.showCollection('home'); },
      onLeaderboard: () => { if (this.assetsReady) this.showLeaderboard(); },
      onShop: () => { if (this.assetsReady) this.showShop(); },
      onDailyReward: () => { if (this.assetsReady) this.showDailyReward(); },
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
    this.showHome();
  }

  private startGame(): void {
    this.showGame(true);
  }

  private showLeaderboard(): void {
    this.clearScreen();
    this.currentScreen = 'leaderboard';
    const root = this.makeScreen('Leaderboard');
    this.leaderboardView.build(root, {
      data: null,
      status: 'loading',
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
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
    });
    try {
      if (!this.leaderboardProfileSyncStarted) {
        this.leaderboardProfileSyncStarted = true;
        await this.leaderboard.syncAuthorizedProfile();
      }
      void this.flushPendingLeaderboardScores();
      const data = await this.leaderboard.getLeaderboard();
      if (token !== this.sceneToken
        || requestSequence !== this.leaderboardRequestSequence
        || this.currentScreen !== 'leaderboard') return;
      this.leaderboardView.update({
        data,
        status: 'ready',
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
        uiWidth: this.uiWidth,
        uiHeight: this.uiHeight,
        topInset: this.topSafeInset(),
        bottomInset: this.bottomSafeInset(),
      });
    }
  }

  private showShop(): void {
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
        this.dialogs.showNotice(this.screenRoot, '\u4eca\u65e5\u5956\u52b1\u5df2\u9886\u53d6');
        return;
      }
      this.dailyRewardOverlay?.destroy();
      this.dailyRewardOverlay = null;
      this.inputLocked = false;
      if (this.currentScreen === 'shop') this.showShop();
      else this.showHome();
    } catch (error) {
      console.warn('[Cat2048] Failed to claim daily reward.', error);
      this.inputLocked = false;
      this.dialogs.showNotice(this.screenRoot, '\u6bcf\u65e5\u5956\u52b1\u9886\u53d6\u5931\u8d25');
    } finally {
      this.dailyClaimInProgress = false;
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
      this.dialogs.showNotice(this.screenRoot, '\u8d2d\u4e70\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
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
        this.dialogs.showNotice(this.screenRoot, '\u8be5\u88c5\u9970\u5c1a\u672a\u62e5\u6709');
        return;
      }
      this.showShop();
    } catch (error) {
      this.inputLocked = false;
      console.warn('[Cat2048] Failed to equip cosmetic.', error);
      this.dialogs.showNotice(this.screenRoot, '\u88c5\u5907\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
    }
  }

  private showCollection(origin: CollectionOrigin): void {
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

  private showGame(startNewGame: boolean): void {
    this.clearScreen();
    this.currentScreen = 'game';
    if (startNewGame) {
      this.currentRunId = `run-${Date.now()}-${++this.runSequence}`;
      this.registerBoardCats(this.game.start());
    }
    const root = this.makeScreen('Game');
    const frame = this.gameScreen.build(root, {
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
      topInset: this.topSafeInset(),
      bottomInset: this.bottomSafeInset(),
      score: this.game.score,
      highScore: this.save.highScore,
      board: this.game.board,
      items: this.game.items,
      unlockedCount: this.save.unlockedCatLevels.length,
    }, {
      isLocked: () => this.inputLocked || this.swipeGuideActive,
      onBack: () => this.confirmLeave(),
      onSettings: () => this.showSettingsDialog(),
      onCollection: () => this.showCollection('game'),
      onSwipe: (direction) => { void this.performMove(direction); },
      onUseItem: (kind) => {
        if (kind === 'undo') void this.useUndoItem();
        else void this.useRemoveLowestItem();
      },
      onRefillItem: (kind) => { void this.shareItemRefill(kind); },
      canUseItem: (kind) => this.canUseItem(kind),
      canRefillItem: (kind) => this.canRequestItemRefill(kind),
    });
    this.swipe = frame.swipe;
    this.showSwipeGuideIfNeeded(root, frame.boardY, frame.boardSize);
    if (this.save.tutorial.swipeGuideCompleted && this.game.status === 'game-over') this.showGameOver();
  }

  private canUseItem(kind: ItemKind): boolean {
    return kind === 'undo' ? this.game.items.canUndo : this.game.items.canRemoveLowest;
  }

  private canRequestItemRefill(kind: ItemKind): boolean {
    return kind === 'undo'
      ? this.game.items.canRequestUndoRefill
      : this.game.items.canRequestRemoveLowestRefill;
  }

  private readonly onKeyDown = (event: EventKeyboard): void => {
    if (!this.boardView.root || this.inputLocked) return;
    const directions: Partial<Record<KeyCode, Direction>> = {
      [KeyCode.ARROW_UP]: 'up', [KeyCode.ARROW_DOWN]: 'down',
      [KeyCode.ARROW_LEFT]: 'left', [KeyCode.ARROW_RIGHT]: 'right',
      [KeyCode.KEY_W]: 'up', [KeyCode.KEY_S]: 'down', [KeyCode.KEY_A]: 'left', [KeyCode.KEY_D]: 'right',
    };
    const direction = directions[event.keyCode];
    if (direction) void this.performMove(direction);
  };

  private async performMove(direction: Direction): Promise<void> {
    if (this.inputLocked) return;
    const result = this.game.move(direction);
    if (!result.changed) {
      if (result.status === 'game-over') this.showGameOver();
      return;
    }
    this.registerBoardCats(result.board);
    if (!this.save.tutorial.swipeGuideCompleted) this.completeSwipeGuide();
    const token = this.sceneToken;
    this.inputLocked = true;
    await this.boardView.animateMove(
      result,
      () => token === this.sceneToken && this.boardView.root !== null,
      {
        onMerge: () => {
          this.haptics.light();
          this.audio.play('merge', 0.8);
        },
        onMove: () => {
          this.audio.play('move', 0.55);
        },
      },
    );
    if (token !== this.sceneToken || !this.boardView.root) return;
    this.updateScore(result.score);
    this.refreshGameViews();
    this.inputLocked = false;
    if (result.status === 'game-over') this.showGameOver();
  }

  private async useUndoItem(): Promise<void> {
    if (this.inputLocked || !this.game.items.canUndo || !this.boardView.root) return;
    const result = this.game.undo();
    if (!result.changed) {
      this.gameScreen.refreshItems(this.game.items);
      return;
    }
    const token = this.sceneToken;
    this.inputLocked = true;
    this.refreshGameViews();
    await this.boardView.fadeRebuild(
      result.board,
      () => token === this.sceneToken && this.boardView.root !== null,
    );
    if (token !== this.sceneToken || !this.boardView.root) return;
    this.updateScore(result.score);
    this.refreshGameViews();
    this.inputLocked = false;
    this.showItemRefillGuideIfNeeded('undo');
  }

  private async useRemoveLowestItem(): Promise<void> {
    if (this.inputLocked || !this.game.items.canRemoveLowest || !this.boardView.root) return;
    const result = this.game.removeLowestTiles(3);
    if (!result.changed) {
      this.gameScreen.refreshItems(this.game.items);
      return;
    }
    const token = this.sceneToken;
    this.inputLocked = true;
    this.gameScreen.refreshItems(this.game.items);
    this.haptics.light();
    this.audio.play('merge', 0.55);
    await this.boardView.animateRemove(
      result.removedTileIds,
      () => token === this.sceneToken && this.boardView.root !== null,
    );
    if (token !== this.sceneToken || !this.boardView.root) return;
    this.boardView.rebuild(result.board, false);
    this.refreshGameViews();
    this.inputLocked = false;
    this.showItemRefillGuideIfNeeded('remove-lowest');
  }

  private registerBoardCats(board: BoardSnapshot): void {
    const unlocked = new Set(this.save.unlockedCatLevels);
    const newLevels = Array.from(new Set(board.tiles.map((tile) => tile.level)))
      .filter((level) => !unlocked.has(level))
      .sort((a, b) => a - b);
    if (newLevels.length === 0) return;
    for (const level of newLevels) unlocked.add(level);
    this.save = {
      ...this.save,
      unlockedCatLevels: Array.from(unlocked).sort((a, b) => a - b),
    };
    runtimeStorage.save(this.save);
  }

  private refreshGameViews(): void {
    this.gameScreen.refreshEvolution(this.game.board, this.save.unlockedCatLevels.length);
    this.gameScreen.refreshItems(this.game.items);
  }

  private showSwipeGuideIfNeeded(root: Node, boardY: number, boardSize: number): void {
    if (this.save.tutorial.swipeGuideCompleted) return;
    this.swipeGuideActive = true;
    this.tutorialView.showSwipe(root, this.uiWidth, this.uiHeight, boardY, boardSize,
      () => this.completeSwipeGuide());
  }

  private completeSwipeGuide(): void {
    if (this.save.tutorial.swipeGuideCompleted) return;
    this.save = {
      ...this.save,
      tutorial: { ...this.save.tutorial, swipeGuideCompleted: true },
    };
    runtimeStorage.save(this.save);
    this.swipeGuideActive = false;
    this.tutorialView.dismissSwipe();
  }

  private showItemRefillGuideIfNeeded(kind: ItemKind): void {
    if (this.save.tutorial.itemRefillGuideCompleted || this.currentScreen !== 'game') return;
    const item = this.itemBar.nodeFor(kind);
    if (!item) return;
    this.save = {
      ...this.save,
      tutorial: { ...this.save.tutorial, itemRefillGuideCompleted: true },
    };
    runtimeStorage.save(this.save);
    this.tutorialView.showItemRefillHint(this.screenRoot ?? item.parent ?? item, item, this.uiHeight);
  }

  private updateScore(score: number): void {
    if (score > this.save.highScore) {
      this.save = { ...this.save, highScore: score };
      runtimeStorage.save(this.save);
    }
    this.gameScreen.updateScore(score, this.save.highScore);
  }

  private applyEconomyResult(result: EconomyMutationResult): void {
    this.applyEconomySnapshot(result);
  }

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
      },
    };
    this.cosmetics.setEquipped(this.save.economy.equipped);
    setButtonTheme(this.cosmetics.buttonTheme());
  }

  private economyErrorText(result: EconomyMutationResult): string {
    if (result.reason === 'insufficient-coins') return '\u91d1\u5e01\u4e0d\u8db3';
    if (result.reason === 'already-owned') return '\u8be5\u88c5\u9970\u5df2\u62e5\u6709';
    return '\u88c5\u9970\u64cd\u4f5c\u5931\u8d25';
  }

  private confirmLeave(): void {
    this.showDialog('返回主页？', '当前棋盘不会保存。', '继续游戏', '返回主页', () => this.showHome());
  }

  private showInfoDialog(): void {
    this.showDialog('怎么玩', '滑动屏幕或使用方向键\n合并两只相同猫咪并不断升级', '知道啦', '开始游戏',
      () => this.startGame());
  }

  private showSettingsDialog(): void {
    if (!this.screenRoot) return;
    const origin = settingsOrigin(this.boardView.root !== null);
    this.inputLocked = true;
    this.settings.show(this.screenRoot, {
      soundEnabled: this.save.soundEnabled,
      hapticsEnabled: this.save.hapticsEnabled,
    }, {
      onSoundChange: (enabled) => {
        this.save = { ...this.save, soundEnabled: enabled };
        this.audio.enabled = enabled;
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

  private showGameOver(): void {
    if (this.gameOverOverlay?.isValid || this.gameOverSettlementInProgress) return;
    this.gameOverSettlementInProgress = true;
    this.inputLocked = true;
    this.updateScore(this.game.score);
    void this.submitCurrentScore();
    this.audio.play('game_over', 0.8);
    void this.settleAndShowGameOver();
  }

  private async submitCurrentScore(): Promise<void> {
    const payload: ScorePayload = {
      runId: this.currentRunId,
      score: this.game.score,
      highestLevel: highestLevelOfTiles(this.game.board.tiles),
    };
    try {
      await this.leaderboard.submitScore(payload);
    } catch (error) {
      console.warn('[Cat2048] Leaderboard score queued for retry.', error);
    }
  }

  private async flushPendingLeaderboardScores(): Promise<void> {
    try {
      await this.leaderboard.flushPendingScores();
    } catch (error) {
      console.warn('[Cat2048] Failed to flush pending leaderboard scores.', error);
    }
  }

  private async settleAndShowGameOver(): Promise<void> {
    let reward = 0;
    let rewardFailed = false;
    try {
      const result = await this.economy.settleRun({
        runId: this.currentRunId,
        score: this.game.score,
        highestLevel: this.game.board.tiles.reduce((highest, tile) => Math.max(highest, tile.level), 1),
      });
      reward = result.awardedCoins;
      this.applyEconomyResult(result);
    } catch (error) {
      rewardFailed = true;
      console.warn('[Cat2048] Failed to settle run reward.', error);
    }
    this.gameOverSettlementInProgress = false;
    if (this.currentScreen !== 'game' || !this.screenRoot) return;
    this.gameOverOverlay = this.gameOverDialog.show(this.screenRoot, {
      score: this.game.score,
      bestScore: this.save.highScore,
      canRevive: this.game.reviveState.canRevive,
      runReward: reward,
      runRewardFailed: rewardFailed,
      coins: this.economySnapshot.coins,
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
    }, {
      onHome: () => { if (!this.shareInProgress) this.showHome(); },
      onReplay: () => { if (!this.shareInProgress) this.startGame(); },
      onShareScore: () => { void this.shareResult(); },
      onRevive: () => { void this.shareRevive(); },
    });
  }

  private async shareResult(): Promise<void> {
    await this.shareCurrentGame('score');
  }

  private async shareItemRefill(kind: ItemKind): Promise<void> {
    if (this.inputLocked || !this.canRequestItemRefill(kind)) return;
    this.inputLocked = true;
    const purpose: SharePurpose = kind === 'undo' ? 'undo-refill' : 'remove-lowest-refill';
    const result = await this.shareCurrentGame(purpose);
    if (this.currentScreen !== 'game' || !this.boardView.root) return;
    if (result === 'shared') this.game.refillItem(kind);
    this.gameScreen.refreshItems(this.game.items);
    this.inputLocked = false;
  }

  private async shareRevive(): Promise<void> {
    if (this.shareInProgress || !this.game.reviveState.canRevive || !this.boardView.root) return;
    const result = await this.shareCurrentGame('revive');
    if (result !== 'shared' || this.currentScreen !== 'game' || !this.boardView.root) return;
    const revived = this.game.revive();
    if (!revived.revived || !revived.changed) return;

    this.gameOverOverlay?.destroy();
    this.gameOverOverlay = null;
    const token = this.sceneToken;
    this.haptics.light();
    this.audio.play('merge', 0.55);
    await this.boardView.animateRemove(
      revived.removedTileIds,
      () => token === this.sceneToken && this.boardView.root !== null,
    );
    if (token !== this.sceneToken || !this.boardView.root) return;
    this.boardView.rebuild(revived.board, false);
    this.refreshGameViews();
    this.inputLocked = false;
  }

  private async shareCurrentGame(purpose: SharePurpose): Promise<ShareResult | null> {
    if (this.shareInProgress || !this.screenRoot) return null;
    const shareRoot = this.screenRoot;
    const token = this.sceneToken;
    const highestLevel = this.game.board.tiles.reduce((highest, tile) => Math.max(highest, tile.level), 1);
    const cat = GAME_CONFIG.cats[highestLevel - 1];
    const backgroundPath = this.art.imagePath(GAME_CONFIG.art.shareScoreBackground);
    const catPath = this.art.imagePath(cat.asset);
    if (!backgroundPath || !catPath) {
      this.dialogs.showNotice(this.screenRoot, '分享卡片素材暂不可用');
      return 'failed';
    }

    this.shareInProgress = true;
    const result = await this.resultShare.share({
      purpose,
      score: this.game.score,
      bestScore: this.save.highScore,
      catLevel: highestLevel,
      catName: cat.name,
      backgroundPath,
      catPath,
    });
    this.shareInProgress = false;
    if (token !== this.sceneToken || this.screenRoot !== shareRoot) return null;
    if (result === 'shared') return result;
    this.dialogs.showNotice(shareRoot, result === 'unsupported'
      ? '请在微信小游戏中分享给好友或群'
      : '分享卡片生成失败，请稍后重试');
    return result;
  }

  private showDialog(titleText: string, bodyText: string, cancelText: string, confirmText: string,
    onConfirm: () => void, onCancel?: () => void, auxiliary?: { text: string; onTap: () => void }): void {
    if (!this.screenRoot) return;
    this.inputLocked = true;
    this.dialogs.show(this.screenRoot, titleText, bodyText, cancelText, confirmText, {
      onConfirm,
      onCancel: () => {
        this.inputLocked = false;
        onCancel?.();
      },
      auxiliary,
    });
  }

  private clearScreen(): void {
    Tween.stopAll();
    this.tutorialView.dismissSwipe();
    this.sceneToken += 1;
    this.inputLocked = false;
    this.swipeGuideActive = false;
    this.shareInProgress = false;
    // Unbind first so late touch-cancel/end cannot fire after the board is gone.
    this.swipe?.unbind();
    this.swipe = null;
    this.dailyRewardOverlay = null;
    this.boardView.unmount();
    this.gameScreen.clear();
    this.shopView.clear();
    this.leaderboardView.clear();
    this.gameOverOverlay = null;
    this.screenRoot?.destroy();
    this.screenRoot = null;
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
