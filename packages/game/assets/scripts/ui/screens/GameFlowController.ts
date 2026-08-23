import { Node } from 'cc';
import { Game2048 } from '../../core/Game2048';
import type { BoardSnapshot, Direction, ItemKind, ItemState } from '../../core/types';
import type { EconomyMutationResult, EconomyRepository } from '../../features/economy/economy';
import type { HapticController } from '../../infrastructure/HapticController';
import type { DailyTaskRepository } from '../../features/tasks/dailyTasks';
import type { RunSessionStore, SavedRun, SavedRunMode } from '../../features/storage/runSession';
import {
  highestLevelOfTiles,
  type LeaderboardClient,
  type ScorePayload,
} from '../../features/leaderboard/leaderboard';
import { shouldCompleteDailyChallenge, evolutionChallengeFor } from '../../features/gameplay/dailyChallenge';
import { calculateCollectionProgress } from '../../features/gameplay/collectionProgress';
import type { SharePurpose, ShareResult } from '../../infrastructure/ResultShareController';
import { RuntimeRandomSource } from '../../features/storage/runtime';
import type { SaveDataV3 } from '../../features/storage/storage';
import type { ArtRepository } from '../utils/ArtRepository';
import type { AudioController } from '../components/AudioController';
import { BoardView } from '../components/BoardView';
import type { CosmeticRuntime } from '../components/CosmeticRuntime';
import { EvolutionPanelView, type EvolutionChallenge } from '../components/EvolutionPanelView';
import { GameOverDialogView } from '../panels/GameOverDialogView';
import { GameScreen, type GameScreenModel } from './GameScreen';
import { GameStatsBarView } from '../components/GameStatsBarView';
import { ItemBarView } from '../components/ItemBarView';
import type { SwipeInput } from '../components/SwipeInput';
import { TutorialView } from '../components/TutorialView';

/**
 * Cat2048Boot 提供给对局流程的宿主能力：页面导航、存档、弹窗、分享。
 * 对局流程只通过该接口与页面层交互，保持自身职责单一。
 */
export interface GameFlowHost {
  isOnGameScreen(): boolean;
  isInputLocked(): boolean;
  lockInput(): void;
  unlockInput(): void;
  getSave(): SaveDataV3;
  commitSave(save: SaveDataV3): void;
  getCoins(): number;
  applyEconomyResult(result: EconomyMutationResult): void;
  showNotice(text: string): void;
  requestShare(purpose: SharePurpose): Promise<ShareResult | null>;
}

/** 对局内需要由宿主执行的页面动作。 */
export interface GameFlowActions {
  onBack(): void;
  onSettings(): void;
  onCollection(): void;
  onHome(): void;
  onReplay(): void;
}

export interface GameFlowDeps {
  readonly art: ArtRepository;
  readonly cosmetics: CosmeticRuntime;
  readonly audio: AudioController;
  readonly haptics: HapticController;
  readonly leaderboard: LeaderboardClient;
  readonly economy: EconomyRepository;
  readonly tasks: DailyTaskRepository;
  readonly runSession: RunSessionStore;
  readonly host: GameFlowHost;
  readonly actions: GameFlowActions;
}

/** 单局游戏的流程编排：核心逻辑 Game2048 与对局视图之间的协调层。 */
export class GameFlowController {
  private readonly boardView: BoardView;
  private readonly gameScreen: GameScreen;
  private readonly itemBar: ItemBarView;
  private readonly evolution: EvolutionPanelView;
  private readonly gameOverDialog: GameOverDialogView;
  private readonly tutorial = new TutorialView();
  private readonly game = new Game2048(new RuntimeRandomSource());
  private sessionToken = 0;
  private gameRoot: Node | null = null;
  private gameOverOverlay: Node | null = null;
  private swipe: SwipeInput | null = null;
  private gameOverSettlementInProgress = false;
  private runSequence = 0;
  private currentRunId = '';
  private runMode: SavedRunMode = 'classic';
  private dailyChallengeCompleted = false;
  private uiWidth = 0;
  private uiHeight = 0;
  private newRecordThisRun = false;
  private movesCount = 0;
  private mergesCount = 0;
  private hasTriggeredHighLevelLoad = false;

  public constructor(private readonly deps: GameFlowDeps) {
    this.boardView = new BoardView(deps.art, deps.cosmetics);
    this.itemBar = new ItemBarView(deps.art);
    this.evolution = new EvolutionPanelView(deps.art, deps.cosmetics);
    this.gameScreen = new GameScreen(deps.art, this.boardView, this.itemBar, this.evolution,
      new GameStatsBarView(deps.art));
    this.gameOverDialog = new GameOverDialogView(deps.art);
  }

  public get board(): BoardSnapshot { return this.game.board; }
  public get score(): number { return this.game.score; }
  public get items(): ItemState { return this.game.items; }
  public get mode(): SavedRunMode { return this.runMode; }
  public get moves(): number { return this.movesCount; }
  public get merges(): number { return this.mergesCount; }

  /** 当前棋盘视图是否挂载（用于设置面板来源判断和键盘输入）。 */
  public isBoardActive(): boolean {
    return this.boardView.root !== null;
  }

  /** 开始一局新游戏并构建对局界面。 */
  public startRun(mode: SavedRunMode = 'classic'): void {
    this.deps.runSession.clear();
    this.currentRunId = `run-${Date.now()}-${++this.runSequence}`;
    this.runMode = mode;
    this.dailyChallengeCompleted = false;
    this.newRecordThisRun = false;
    this.movesCount = 0;
    this.mergesCount = 0;
    this.hasTriggeredHighLevelLoad = false;
    this.registerBoardCats(this.game.start());
  }

  /** 恢复一局未完成的游戏（跨启动续玩）。 */
  public resumeRun(savedRun: SavedRun): void {
    this.currentRunId = savedRun.runId;
    this.runMode = savedRun.mode ?? 'classic';
    this.dailyChallengeCompleted = savedRun.dailyChallengeCompleted === true;
    this.game.restore(savedRun);
    if (shouldCompleteDailyChallenge(this.runMode, false, highestLevelOfTiles(this.game.board.tiles))) {
      this.dailyChallengeCompleted = true;
    }
    this.newRecordThisRun = this.game.score > this.deps.host.getSave().highScore;
    this.movesCount = savedRun.moves ?? 0;
    this.mergesCount = savedRun.merges ?? 0;
    this.registerBoardCats(this.game.board);
  }

  public buildGameScreen(root: Node, model: GameScreenModel): void {
    this.gameRoot = root;
    this.uiWidth = model.uiWidth;
    this.uiHeight = model.uiHeight;
    const frame = this.gameScreen.build(root, {
      ...model,
      challenge: this.evolutionChallenge(),
    }, {
      isLocked: () => this.deps.host.isInputLocked(),
      onBack: () => this.deps.actions.onBack(),
      onSettings: () => this.deps.actions.onSettings(),
      onCollection: () => this.deps.actions.onCollection(),
      onSwipe: (direction) => { void this.performMove(direction); },
      onUseItem: (kind) => { void this.useItem(kind); },
      canUseItem: (kind) => this.canUseItem(kind),
      inventoryCount: (kind) => this.inventoryCount(kind),
    });
    this.swipe = frame.swipe;
    this.showSwipeGuideIfNeeded(root, frame.boardY, frame.boardSize);
    if (this.deps.host.getSave().tutorial.swipeGuideCompleted
      && this.game.status === 'game-over') this.showGameOver();
  }

  public canUseItem(kind: ItemKind): boolean {
    return this.game.items.canUse(kind) && this.deps.economy.hasItem(kind);
  }

  public inventoryCount(kind: ItemKind): number {
    return this.deps.economy.getItemCount(kind);
  }

  public async performMove(direction: Direction): Promise<void> {
    if (this.deps.host.isInputLocked()) return;
    const result = this.game.move(direction);
    if (!result.changed) {
      if (result.status === 'game-over') this.showGameOver();
      return;
    }
    this.registerBoardCats(result.board);
    this.movesCount += 1;
    this.mergesCount += result.merges.length;
    const completedDailyChallenge = this.completeDailyChallengeIfNeeded(result.board);
    this.persistRun();
    if (!this.deps.host.getSave().tutorial.swipeGuideCompleted) this.completeSwipeGuide();

    // 懒加载高级资源：当首次达到 5 级时触发
    if (!this.hasTriggeredHighLevelLoad) {
      const maxLevel = Math.max(...result.board.tiles.map(t => t.level));
      if (maxLevel >= 5) {
        this.hasTriggeredHighLevelLoad = true;
        const currentSkin = this.deps.host.getSave().economy.equipped.catSkin;
        // 异步加载，不阻塞游戏
        this.deps.art.loadHighLevelAssets(currentSkin).catch(err => {
          console.error('[GameFlow] Failed to preload high-level assets:', err);
        });
      }
    }

    const token = this.sessionToken;
    this.deps.host.lockInput();
    await this.boardView.animateMove(
      result,
      () => token === this.sessionToken && this.boardView.root !== null,
      {
        onMerge: () => {
          this.deps.haptics.light();
          this.deps.audio.play('merge', 0.8);
        },
        onMove: () => {
          this.deps.audio.play('move', 0.55);
        },
      },
    );
    if (token !== this.sessionToken || !this.boardView.root) return;
    this.updateScore(result.score);
    this.refreshGameViews();
    this.deps.host.unlockInput();
    if (completedDailyChallenge) this.deps.host.showNotice('今日挑战完成！');
    if (result.status === 'game-over') this.showGameOver();
  }

  /** 统一道具使用入口 */
  public async useItem(kind: ItemKind): Promise<void> {
    if (this.deps.host.isInputLocked() || !this.canUseItem(kind) || !this.boardView.root) return;

    switch (kind) {
      case 'undo': await this.useUndoItem(); break;
      case 'spawn': await this.useSpawnItem(); break;
      case 'shuffle': await this.useShuffleItem(); break;
      case 'erase': await this.useEraseItem(); break;
    }
  }

  private async useUndoItem(): Promise<void> {
    const result = this.game.undo();
    if (!result.changed) {
      this.refreshItemViews();
      return;
    }
    await this.consumeItemFromInventory('undo');
    this.deps.tasks.recordEvent('use-items');
    this.persistRun();
    const token = this.sessionToken;
    this.deps.host.lockInput();
    this.refreshGameViews();
    await this.boardView.fadeRebuild(
      result.board,
      () => token === this.sessionToken && this.boardView.root !== null,
    );
    if (token !== this.sessionToken || !this.boardView.root) return;
    this.updateScore(result.score);
    this.refreshGameViews();
    this.deps.host.unlockInput();
  }

  private async useSpawnItem(): Promise<void> {
    const result = this.game.spawn();
    if (!result.changed) {
      this.refreshItemViews();
      return;
    }
    await this.consumeItemFromInventory('spawn');
    this.deps.tasks.recordEvent('use-items');
    this.persistRun();
    const token = this.sessionToken;
    this.deps.host.lockInput();
    this.refreshGameViews();
    if (result.spawned) {
      this.deps.haptics.light();
      this.deps.audio.play('merge', 0.55);
    }
    await this.boardView.fadeRebuild(
      result.board,
      () => token === this.sessionToken && this.boardView.root !== null,
    );
    if (token !== this.sessionToken || !this.boardView.root) return;
    this.refreshGameViews();
    this.deps.host.unlockInput();
  }

  private async useShuffleItem(): Promise<void> {
    const result = this.game.shuffle();
    if (!result.changed) {
      this.refreshItemViews();
      return;
    }
    await this.consumeItemFromInventory('shuffle');
    this.deps.tasks.recordEvent('use-items');
    this.persistRun();
    const token = this.sessionToken;
    this.deps.host.lockInput();
    this.refreshGameViews();
    this.deps.haptics.light();
    this.deps.audio.play('merge', 0.55);
    await this.boardView.fadeRebuild(
      result.board,
      () => token === this.sessionToken && this.boardView.root !== null,
    );
    if (token !== this.sessionToken || !this.boardView.root) return;
    this.refreshGameViews();
    this.deps.host.unlockInput();
  }

  private async useEraseItem(): Promise<void> {
    // 消除需要选择目标，暂用随机选择最低等级猫咪
    const tiles = [...this.game.board.tiles];
    if (tiles.length === 0) {
      this.refreshItemViews();
      return;
    }
    tiles.sort((a, b) => a.level - b.level);
    const target = tiles[0];
    const result = this.game.erase({ row: target.row, col: target.col });
    if (!result.changed) {
      this.refreshItemViews();
      return;
    }
    await this.consumeItemFromInventory('erase');
    this.deps.tasks.recordEvent('use-items');
    this.persistRun();
    const token = this.sessionToken;
    this.deps.host.lockInput();
    this.refreshGameViews();
    this.deps.haptics.light();
    this.deps.audio.play('merge', 0.55);
    await this.boardView.animateRemove(
      [result.removedTileId!],
      () => token === this.sessionToken && this.boardView.root !== null,
    );
    if (token !== this.sessionToken || !this.boardView.root) return;
    this.boardView.rebuild(result.board, false);
    this.refreshGameViews();
    this.deps.host.unlockInput();
  }

  public async shareRevive(): Promise<void> {
    if (!this.game.reviveState.canRevive || !this.boardView.root) return;
    const result = await this.deps.host.requestShare('revive');
    if (result !== 'shared' || !this.deps.host.isOnGameScreen() || !this.boardView.root) return;
    const revived = this.game.revive();
    if (!revived.revived || !revived.changed) return;
    this.gameOverSettlementInProgress = false;
    this.persistRun();

    this.gameOverOverlay?.destroy();
    this.gameOverOverlay = null;
    const token = this.sessionToken;
    this.deps.haptics.light();
    this.deps.audio.play('merge', 0.55);
    await this.boardView.animateRemove(
      revived.removedTileIds,
      () => token === this.sessionToken && this.boardView.root !== null,
    );
    if (token !== this.sessionToken || !this.boardView.root) return;
    this.boardView.rebuild(revived.board, false);
    this.refreshGameViews();
    this.deps.host.unlockInput();
  }

  public async shareResult(): Promise<void> {
    await this.deps.host.requestShare('score');
  }

  /** 页面离开时清理对局视图与动画，避免跨场景残留。 */
  public teardown(): void {
    this.sessionToken += 1;
    this.tutorial.dismissSwipe();
    this.gameOverSettlementInProgress = false;
    this.swipe?.unbind();
    this.swipe = null;
    this.gameOverOverlay = null;
    this.boardView.unmount();
    this.gameScreen.clear();
    this.gameRoot = null;
    // 确保在页面离开时保存状态
    this.deps.runSession.flush();
  }

  private showGameOver(): void {
    if (this.gameOverOverlay?.isValid || this.gameOverSettlementInProgress) return;
    this.gameOverSettlementInProgress = true;
    // 立即保存游戏状态
    this.deps.runSession.flush();
    this.deps.runSession.clear();
    this.deps.host.lockInput();
    this.updateScore(this.game.score);
    this.deps.audio.play('game_over', 0.8);
    const hasRescueItem = this.game.items.canUseMore
      && (['undo', 'spawn', 'shuffle', 'erase'] as ItemKind[]).some((k) => this.canUseItem(k));
    if (hasRescueItem) {
      this.showRescueGameOver();
    } else {
      void this.settleAndShowGameOver();
    }
  }

  private showRescueGameOver(): void {
    if (!this.deps.host.isOnGameScreen() || !this.gameRoot) return;
    this.gameOverOverlay = this.gameOverDialog.show(this.gameRoot, {
      score: this.game.score,
      bestScore: this.deps.host.getSave().highScore,
      canRevive: this.game.reviveState.canRevive,
      canUndoRescue: this.canUseItem('undo'),
      canRemoveLowestRescue: this.canUseItem('erase'),
      undoRescueCount: this.inventoryCount('undo'),
      removeLowestRescueCount: this.inventoryCount('erase'),
      isNewRecord: this.newRecordThisRun,
      runReward: 0,
      runRewardFailed: false,
      coins: this.deps.host.getCoins(),
      highestLevel: highestLevelOfTiles(this.game.board.tiles),
      moves: this.movesCount,
      merges: this.mergesCount,
      dailyChallenge: this.gameOverChallenge(),
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
    }, {
      onHome: () => { void this.finishGameOver(() => this.deps.actions.onHome()); },
      onReplay: () => { void this.finishGameOver(() => this.deps.actions.onReplay()); },
      onShareScore: () => { void this.finishGameOver(() => {
        void this.shareResult().then(() => this.deps.actions.onHome());
      }); },
      onRevive: () => { void this.shareRevive(); },
      onUndoRescue: () => this.rescueWithItem('undo'),
      onRemoveLowestRescue: () => this.rescueWithItem('erase'),
    });
  }

  private rescueWithItem(kind: ItemKind): void {
    if (!this.canUseItem(kind)) return;
    this.gameOverOverlay?.destroy();
    this.gameOverOverlay = null;
    this.gameOverSettlementInProgress = false;
    this.deps.host.unlockInput();
    void this.useItem(kind);
  }

  private async finishGameOver(after: () => void): Promise<void> {
    if (!this.gameOverSettlementInProgress) return;
    await this.settleGameOver();
    this.gameOverOverlay?.destroy();
    this.gameOverOverlay = null;
    after();
  }

  private async submitCurrentScore(): Promise<void> {
    const payload: ScorePayload = {
      runId: this.currentRunId,
      score: this.game.score,
      highestLevel: highestLevelOfTiles(this.game.board.tiles),
    };
    try {
      await this.deps.leaderboard.submitScore(payload);
    } catch (error) {
      console.warn('[Cat2048] Leaderboard score queued for retry.', error);
    }
  }

  private async settleGameOver(): Promise<{ reward: number; rewardFailed: boolean }> {
    await this.submitCurrentScore();
    let reward = 0;
    let rewardFailed = false;
    try {
      const result = await this.deps.economy.settleRun({
        runId: this.currentRunId,
        score: this.game.score,
        highestLevel: highestLevelOfTiles(this.game.board.tiles),
      });
      reward = result.awardedCoins;
      this.deps.host.applyEconomyResult(result);
    } catch (error) {
      rewardFailed = true;
      console.warn('[Cat2048] Failed to settle run reward.', error);
    }
    this.deps.tasks.recordEvent('play-runs');
    if (highestLevelOfTiles(this.game.board.tiles) >= 5) {
      this.deps.tasks.recordEvent('reach-lv5');
    }
    this.gameOverSettlementInProgress = false;
    return { reward, rewardFailed };
  }

  private async settleAndShowGameOver(): Promise<void> {
    const { reward, rewardFailed } = await this.settleGameOver();
    if (!this.deps.host.isOnGameScreen() || !this.gameRoot) return;
    this.gameOverOverlay = this.gameOverDialog.show(this.gameRoot, {
      score: this.game.score,
      bestScore: this.deps.host.getSave().highScore,
      canRevive: this.game.reviveState.canRevive,
      canUndoRescue: false,
      canRemoveLowestRescue: false,
      undoRescueCount: 0,
      removeLowestRescueCount: 0,
      isNewRecord: this.newRecordThisRun,
      runReward: reward,
      runRewardFailed: rewardFailed,
      coins: this.deps.host.getCoins(),
      highestLevel: highestLevelOfTiles(this.game.board.tiles),
      moves: this.movesCount,
      merges: this.mergesCount,
      dailyChallenge: this.gameOverChallenge(),
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
    }, {
      onHome: () => this.deps.actions.onHome(),
      onReplay: () => this.deps.actions.onReplay(),
      onShareScore: () => { void this.shareResult(); },
      onRevive: () => { void this.shareRevive(); },
      onUndoRescue: () => undefined,
      onRemoveLowestRescue: () => undefined,
    });
  }

  private async consumeItemFromInventory(kind: ItemKind): Promise<void> {
    try {
      const result = await this.deps.economy.consumeItems(kind, 1);
      this.deps.host.applyEconomyResult(result);
    } catch (error) {
      console.warn(`[Cat2048] Failed to consume ${kind} item.`, error);
    }
  }

  private persistRun(): void {
    this.deps.runSession.save({
      runId: this.currentRunId,
      ...this.game.exportState(),
      savedAt: Date.now(),
      mode: this.runMode,
      dailyChallengeCompleted: this.dailyChallengeCompleted,
      moves: this.movesCount,
      merges: this.mergesCount,
    });
  }

  private registerBoardCats(board: BoardSnapshot): void {
    const save = this.deps.host.getSave();
    const progress = calculateCollectionProgress(
      board.tiles.map((tile) => tile.level),
      save.unlockedCatLevels,
    );
    if (progress.newLevels.length === 0) return;
    const unlocked = new Set(save.unlockedCatLevels);
    for (const level of progress.newLevels) unlocked.add(level);
    this.deps.host.commitSave({
      ...save,
      unlockedCatLevels: Array.from(unlocked).sort((a, b) => a - b),
    });
    if (progress.rewardCoins > 0) void this.awardCollectionReward(progress.rewardCoins);
  }

  private async awardCollectionReward(coins: number): Promise<void> {
    try {
      const result = await this.deps.economy.grantCoins(coins);
      this.deps.host.applyEconomyResult(result);
      this.deps.host.showNotice(`图鉴奖励 +${coins} 金币`);
    } catch (error) {
      console.warn('[Cat2048] Failed to award collection reward.', error);
    }
  }

  private refreshGameViews(): void {
    this.gameScreen.refreshEvolution(this.game.board, this.deps.host.getSave().unlockedCatLevels.length,
      this.evolutionChallenge());
    this.refreshItemViews();
    this.gameScreen.refreshStats(this.game.board, this.movesCount, this.mergesCount);
  }

  private refreshItemViews(): void {
    const inventoryCounts: Record<ItemKind, number> = {
      undo: this.inventoryCount('undo'),
      spawn: this.inventoryCount('spawn'),
      shuffle: this.inventoryCount('shuffle'),
      erase: this.inventoryCount('erase'),
    };
    this.gameScreen.refreshItems(this.game.items, inventoryCounts);
  }

  private evolutionChallenge(): EvolutionChallenge | undefined {
    return evolutionChallengeFor(this.runMode, this.dailyChallengeCompleted);
  }

  private gameOverChallenge(): { targetLevel: number; completed: boolean } | undefined {
    const challenge = this.evolutionChallenge();
    return challenge ? { ...challenge } : undefined;
  }

  private completeDailyChallengeIfNeeded(board: BoardSnapshot): boolean {
    if (!shouldCompleteDailyChallenge(this.runMode, this.dailyChallengeCompleted,
      highestLevelOfTiles(board.tiles))) return false;
    this.dailyChallengeCompleted = true;
    return true;
  }

  private updateScore(score: number): void {
    const save = this.deps.host.getSave();
    if (score > save.highScore) {
      this.newRecordThisRun = true;
      this.deps.host.commitSave({ ...save, highScore: score });
      this.deps.host.showNotice('新纪录！');
    }
    this.gameScreen.updateScore(score, this.deps.host.getSave().highScore);
  }

  private showSwipeGuideIfNeeded(root: Node, boardY: number, boardSize: number): void {
    if (this.deps.host.getSave().tutorial.swipeGuideCompleted) return;
    this.tutorial.showSwipe(root, this.uiWidth, this.uiHeight, boardY, boardSize,
      () => this.completeSwipeGuide());
  }

  private completeSwipeGuide(): void {
    const save = this.deps.host.getSave();
    if (save.tutorial.swipeGuideCompleted) return;
    this.deps.host.commitSave({
      ...save,
      tutorial: { ...save.tutorial, swipeGuideCompleted: true },
    });
    this.tutorial.dismissSwipe();
  }


}
