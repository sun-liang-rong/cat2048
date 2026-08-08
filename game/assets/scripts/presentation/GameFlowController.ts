import { Node } from 'cc';
import { Game2048 } from '../core/Game2048';
import type { BoardSnapshot, Direction, ItemKind, ItemState } from '../core/types';
import type { EconomyMutationResult, EconomyRepository } from '../economy/economy';
import type { HapticController } from '../infrastructure/HapticController';
import type { DailyTaskRepository } from '../infrastructure/dailyTasks';
import type { RunSessionStore, SavedRun } from '../infrastructure/runSession';
import {
  highestLevelOfTiles,
  type LeaderboardClient,
  type ScorePayload,
} from '../infrastructure/leaderboard';
import type { SharePurpose, ShareResult } from '../infrastructure/ResultShareController';
import { RuntimeRandomSource } from '../infrastructure/runtime';
import type { SaveDataV3 } from '../infrastructure/storage';
import type { ArtRepository } from './ArtRepository';
import type { AudioController } from './AudioController';
import { BoardView } from './BoardView';
import type { CosmeticRuntime } from './CosmeticRuntime';
import { EvolutionPanelView } from './EvolutionPanelView';
import { GameOverDialogView } from './GameOverDialogView';
import { GameScreen, type GameScreenModel } from './GameScreen';
import { ItemBarView } from './ItemBarView';
import type { SwipeInput } from './SwipeInput';
import { TutorialView } from './TutorialView';

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
  private uiWidth = 0;
  private uiHeight = 0;

  public constructor(private readonly deps: GameFlowDeps) {
    this.boardView = new BoardView(deps.art, deps.cosmetics);
    this.itemBar = new ItemBarView(deps.art);
    this.evolution = new EvolutionPanelView(deps.art, deps.cosmetics);
    this.gameScreen = new GameScreen(deps.art, this.boardView, this.itemBar, this.evolution);
    this.gameOverDialog = new GameOverDialogView(deps.art);
  }

  public get board(): BoardSnapshot { return this.game.board; }
  public get score(): number { return this.game.score; }
  public get items(): ItemState { return this.game.items; }

  /** 当前棋盘视图是否挂载（用于设置面板来源判断和键盘输入）。 */
  public isBoardActive(): boolean {
    return this.boardView.root !== null;
  }

  /** 开始一局新游戏并构建对局界面。 */
  public startRun(): void {
    this.deps.runSession.clear();
    this.currentRunId = `run-${Date.now()}-${++this.runSequence}`;
    this.registerBoardCats(this.game.start());
  }

  /** 恢复一局未完成的游戏（跨启动续玩）。 */
  public resumeRun(savedRun: SavedRun): void {
    this.currentRunId = savedRun.runId;
    this.game.restore(savedRun);
    this.registerBoardCats(this.game.board);
  }

  public buildGameScreen(root: Node, model: GameScreenModel): void {
    this.gameRoot = root;
    this.uiWidth = model.uiWidth;
    this.uiHeight = model.uiHeight;
    const frame = this.gameScreen.build(root, model, {
      isLocked: () => this.deps.host.isInputLocked(),
      onBack: () => this.deps.actions.onBack(),
      onSettings: () => this.deps.actions.onSettings(),
      onCollection: () => this.deps.actions.onCollection(),
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
    if (this.deps.host.getSave().tutorial.swipeGuideCompleted
      && this.game.status === 'game-over') this.showGameOver();
  }

  public canUseItem(kind: ItemKind): boolean {
    return kind === 'undo' ? this.game.items.canUndo : this.game.items.canRemoveLowest;
  }

  public canRequestItemRefill(kind: ItemKind): boolean {
    return kind === 'undo'
      ? this.game.items.canRequestUndoRefill
      : this.game.items.canRequestRemoveLowestRefill;
  }

  public async performMove(direction: Direction): Promise<void> {
    if (this.deps.host.isInputLocked()) return;
    const result = this.game.move(direction);
    if (!result.changed) {
      if (result.status === 'game-over') this.showGameOver();
      return;
    }
    this.registerBoardCats(result.board);
    this.persistRun();
    if (!this.deps.host.getSave().tutorial.swipeGuideCompleted) this.completeSwipeGuide();
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
    if (result.status === 'game-over') this.showGameOver();
  }

  public async useUndoItem(): Promise<void> {
    if (this.deps.host.isInputLocked() || !this.game.items.canUndo || !this.boardView.root) return;
    const result = this.game.undo();
    if (!result.changed) {
      this.gameScreen.refreshItems(this.game.items);
      return;
    }
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
    this.showItemRefillGuideIfNeeded('undo');
  }

  public async useRemoveLowestItem(): Promise<void> {
    if (this.deps.host.isInputLocked() || !this.game.items.canRemoveLowest || !this.boardView.root) return;
    const result = this.game.removeLowestTiles(3);
    if (!result.changed) {
      this.gameScreen.refreshItems(this.game.items);
      return;
    }
    this.deps.tasks.recordEvent('use-items');
    this.persistRun();
    const token = this.sessionToken;
    this.deps.host.lockInput();
    this.gameScreen.refreshItems(this.game.items);
    this.deps.haptics.light();
    this.deps.audio.play('merge', 0.55);
    await this.boardView.animateRemove(
      result.removedTileIds,
      () => token === this.sessionToken && this.boardView.root !== null,
    );
    if (token !== this.sessionToken || !this.boardView.root) return;
    this.boardView.rebuild(result.board, false);
    this.refreshGameViews();
    this.deps.host.unlockInput();
    this.showItemRefillGuideIfNeeded('remove-lowest');
  }

  public async shareItemRefill(kind: ItemKind): Promise<void> {
    if (this.deps.host.isInputLocked() || !this.canRequestItemRefill(kind)) return;
    this.deps.host.lockInput();
    const purpose: SharePurpose = kind === 'undo' ? 'undo-refill' : 'remove-lowest-refill';
    const result = await this.deps.host.requestShare(purpose);
    if (!this.deps.host.isOnGameScreen() || !this.boardView.root) return;
    if (result === 'shared') {
      if (this.game.refillItem(kind).granted) this.persistRun();
    }
    this.gameScreen.refreshItems(this.game.items);
    this.deps.host.unlockInput();
  }

  public async shareRevive(): Promise<void> {
    if (!this.game.reviveState.canRevive || !this.boardView.root) return;
    const result = await this.deps.host.requestShare('revive');
    if (result !== 'shared' || !this.deps.host.isOnGameScreen() || !this.boardView.root) return;
    const revived = this.game.revive();
    if (!revived.revived || !revived.changed) return;
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
  }

  private showGameOver(): void {
    if (this.gameOverOverlay?.isValid || this.gameOverSettlementInProgress) return;
    this.gameOverSettlementInProgress = true;
    this.deps.runSession.clear();
    this.deps.host.lockInput();
    this.updateScore(this.game.score);
    void this.submitCurrentScore();
    this.deps.audio.play('game_over', 0.8);
    void this.settleAndShowGameOver();
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

  private async settleAndShowGameOver(): Promise<void> {
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
    if (!this.deps.host.isOnGameScreen() || !this.gameRoot) return;
    this.gameOverOverlay = this.gameOverDialog.show(this.gameRoot, {
      score: this.game.score,
      bestScore: this.deps.host.getSave().highScore,
      canRevive: this.game.reviveState.canRevive,
      runReward: reward,
      runRewardFailed: rewardFailed,
      coins: this.deps.host.getCoins(),
      uiWidth: this.uiWidth,
      uiHeight: this.uiHeight,
    }, {
      onHome: () => this.deps.actions.onHome(),
      onReplay: () => this.deps.actions.onReplay(),
      onShareScore: () => { void this.shareResult(); },
      onRevive: () => { void this.shareRevive(); },
    });
  }

  private persistRun(): void {
    this.deps.runSession.save({
      runId: this.currentRunId,
      ...this.game.exportState(),
      savedAt: Date.now(),
    });
  }

  private registerBoardCats(board: BoardSnapshot): void {
    const save = this.deps.host.getSave();
    const unlocked = new Set(save.unlockedCatLevels);
    const newLevels = Array.from(new Set(board.tiles.map((tile) => tile.level)))
      .filter((level) => !unlocked.has(level))
      .sort((a, b) => a - b);
    if (newLevels.length === 0) return;
    for (const level of newLevels) unlocked.add(level);
    this.deps.host.commitSave({
      ...save,
      unlockedCatLevels: Array.from(unlocked).sort((a, b) => a - b),
    });
  }

  private refreshGameViews(): void {
    this.gameScreen.refreshEvolution(this.game.board, this.deps.host.getSave().unlockedCatLevels.length);
    this.gameScreen.refreshItems(this.game.items);
  }

  private updateScore(score: number): void {
    const save = this.deps.host.getSave();
    if (score > save.highScore) {
      this.deps.host.commitSave({ ...save, highScore: score });
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

  private showItemRefillGuideIfNeeded(kind: ItemKind): void {
    const save = this.deps.host.getSave();
    if (save.tutorial.itemRefillGuideCompleted || !this.deps.host.isOnGameScreen()) return;
    const item = this.itemBar.nodeFor(kind);
    if (!item) return;
    this.deps.host.commitSave({
      ...save,
      tutorial: { ...save.tutorial, itemRefillGuideCompleted: true },
    });
    this.tutorial.showItemRefillHint(this.gameRoot ?? item.parent ?? item, item, this.uiHeight);
  }
}
