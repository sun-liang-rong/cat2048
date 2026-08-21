import {
  Color,
  Label,
  Node,
  UITransform,
  Vec3,
} from 'cc';
import type { BoardSnapshot, Direction, ItemKind, ItemState } from '../../core/types';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import { highestLevelOfTiles } from '../../features/leaderboard/leaderboard';
import type { ArtRepository } from '../utils/ArtRepository';
import { addCoverBackground } from '../styles/background';
import { BoardView } from '../components/BoardView';
import { BOARD_PIXELS } from '../styles/boardGeometry';
import {
  capsuleBottomInset,
  gameLayout,
} from '../styles/layout';
import { EvolutionPanelView, type EvolutionChallenge } from '../components/EvolutionPanelView';
import { GameStatsBarView } from '../components/GameStatsBarView';
import { ItemBarView } from '../components/ItemBarView';
import { SwipeInput } from '../components/SwipeInput';
import {
  COLORS,
  createIconButton,
  createLabel,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';

const BOTTOM_EDGE_ICON_CROP = { x: 4, y: 0, width: 144, height: 144 } as const;
const HUD_VALUE_FONT_SIZE = 34;

export interface GameScreenActions {
  readonly isLocked: () => boolean;
  readonly onBack: () => void;
  readonly onSettings: () => void;
  readonly onCollection: () => void;
  readonly onSwipe: (direction: Direction) => void;
  readonly onUseItem: (kind: ItemKind) => void;
  readonly onRefillItem: (kind: ItemKind) => void;
  readonly canUseItem: (kind: ItemKind) => boolean;
  readonly canRefillItem: (kind: ItemKind) => boolean;
}

export interface GameScreenModel {
  readonly uiWidth: number;
  readonly uiHeight: number;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly score: number;
  readonly highScore: number;
  readonly moves: number;
  readonly merges: number;
  readonly board: BoardSnapshot;
  readonly items: ItemState;
  readonly unlockedCount: number;
  readonly challenge?: EvolutionChallenge;
}

export interface GameScreenBuildResult {
  readonly swipe: SwipeInput;
  readonly boardY: number;
  readonly boardSize: number;
}

export class GameScreen {
  private scoreLabel: Label | null = null;
  private highScoreLabel: Label | null = null;

  public constructor(
    private readonly art: ArtRepository,
    private readonly boardView: BoardView,
    private readonly itemBar: ItemBarView,
    private readonly evolution: EvolutionPanelView,
    private readonly statsBar: GameStatsBarView,
  ) {}

  public build(parent: Node, model: GameScreenModel, actions: GameScreenActions): GameScreenBuildResult {
    addCoverBackground(
      parent,
      this.art,
      GAME_CONFIG.art.pageBackground,
      model.uiWidth,
      model.uiHeight,
      new Color(249, 235, 206, 255),
    );

    const layout = gameLayout(model.uiWidth, model.uiHeight, model.topInset, model.bottomInset, BOARD_PIXELS);
    const hudY = model.uiHeight / 2 - layout.hudCenterFromTop;
    const back = createIconButton('Back', this.art.frame(GAME_CONFIG.art.back), '‹', 76,
      () => { if (!actions.isLocked()) actions.onBack(); });
    back.setPosition(-model.uiWidth / 2 + 62, hudY);
    parent.addChild(back);
    const settings = createIconButton('Settings', this.art.frame(GAME_CONFIG.art.settings), '⚙', 76,
      () => { if (!actions.isLocked()) actions.onSettings(); }, BOTTOM_EDGE_ICON_CROP);
    settings.setPosition(model.uiWidth / 2 - 62, hudY);
    parent.addChild(settings);

    const scoreCard = this.createHudCard('本局', String(model.score));
    scoreCard.node.setPosition(-115, hudY);
    parent.addChild(scoreCard.node);
    this.scoreLabel = scoreCard.value;
    const bestCard = this.createHudCard('最高', String(model.highScore));
    bestCard.node.setPosition(115, hudY);
    parent.addChild(bestCard.node);
    this.highScoreLabel = bestCard.value;

    const highestLevel = highestLevelOfTiles(model.board.tiles);
    this.evolution.mount(parent, model.uiHeight / 2 - layout.evolutionPanelCenterFromTop,
      layout.evolutionPanelHeight, highestLevel, model.unlockedCount, {
        isLocked: actions.isLocked,
        onCollection: actions.onCollection,
      }, model.challenge);

    if (layout.statsBarHeight > 0) {
      this.statsBar.mount(parent, model.uiHeight / 2 - layout.statsBarCenterFromTop, {
        moves: model.moves,
        merges: model.merges,
        spaces: model.board.size * model.board.size - model.board.tiles.length,
      });
    }

    const board = this.boardView.mount(parent, BOARD_PIXELS);
    const boardY = model.uiHeight / 2 - layout.boardTop - BOARD_PIXELS * layout.boardScale / 2;
    board.setPosition(0, boardY);
    board.setScale(layout.boardScale, layout.boardScale, 1);
    const swipe = new SwipeInput(
      actions.isLocked,
      actions.onSwipe,
      (x, y) => this.boardView.showTouchHighlight(x, y),
      () => this.boardView.clearTouchHighlight(),
    );
    swipe.bind(board, (uiX, uiY) => {
      const local = board.getComponent(UITransform)?.convertToNodeSpaceAR(new Vec3(uiX, uiY, 0));
      return local ? { x: local.x, y: local.y } : null;
    });
    this.boardView.renderInitial(model.board);

    this.itemBar.mount(parent, model.uiHeight / 2 - layout.itemBarCenterFromTop, {
      isLocked: actions.isLocked,
      canUse: actions.canUseItem,
      canRefill: actions.canRefillItem,
      onUse: actions.onUseItem,
      onRefill: actions.onRefillItem,
    });
    this.itemBar.refresh(model.items);

    return {
      swipe,
      boardY,
      boardSize: BOARD_PIXELS * layout.boardScale,
    };
  }

  public refreshItems(state: ItemState): void {
    this.itemBar.refresh(state);
  }

  public refreshEvolution(board: BoardSnapshot, unlockedCount: number, challenge?: EvolutionChallenge): void {
    this.evolution.setChallenge(challenge);
    this.evolution.refresh(highestLevelOfTiles(board.tiles), unlockedCount);
  }

  public refreshStats(board: BoardSnapshot, moves: number, merges: number): void {
    this.statsBar.refresh({
      moves,
      merges,
      spaces: board.size * board.size - board.tiles.length,
    });
  }

  public updateScore(score: number, highScore: number): void {
    this.setHudValue(this.scoreLabel, score);
    this.setHudValue(this.highScoreLabel, highScore);
  }

  public clear(): void {
    this.scoreLabel = null;
    this.highScoreLabel = null;
    this.itemBar.clear();
    this.evolution.clear();
    this.statsBar.clear();
  }

  private createHudCard(titleText: string, valueText: string): { node: Node; value: Label } {
    const node = createUiNode(`Hud:${titleText}`, 190, 92);
    drawRounded(node, 190, 92, new Color(255, 248, 226, 240), 24, { color: COLORS.ink, width: 4 });
    const title = createLabel(titleText, 20, COLORS.teal, 160, 30, 'display');
    title.node.setPosition(0, 24);
    node.addChild(title.node);
    const value = this.createHudValue(valueText);
    value.node.setPosition(0, -15);
    node.addChild(value.node);
    return { node, value };
  }

  private createHudValue(valueText: string): Label {
    // NONE：固定字号、不裁剪、不缩放；超大分数完整显示（居中溢出卡片边缘）。
    const value = createLabel(valueText, HUD_VALUE_FONT_SIZE, COLORS.ink, 178, 48, 'display', 'display');
    value.enableWrapText = false;
    value.overflow = Label.Overflow.NONE;
    return value;
  }

  private setHudValue(label: Label | null, value: number): void {
    if (label) label.string = String(value);
  }
}
