import {
  Color,
  Label,
  Node,
  UITransform,
  Vec3,
} from 'cc';
import type { BoardSnapshot, Direction, ItemKind, ItemState } from '../core/types';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import { addCoverBackground } from './background';
import { BoardView } from './BoardView';
import { BOARD_PIXELS } from './boardGeometry';
import {
  capsuleBottomInset,
  gameLayout,
} from './layout';
import { EvolutionPanelView } from './EvolutionPanelView';
import { ItemBarView } from './ItemBarView';
import { SwipeInput } from './SwipeInput';
import {
  COLORS,
  createIconButton,
  createLabel,
  createUiNode,
  drawRounded,
} from './uiFactory';

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
  readonly board: BoardSnapshot;
  readonly items: ItemState;
  readonly unlockedCount: number;
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

    const highestLevel = this.highestLevel(model.board);
    this.evolution.mount(parent, model.uiHeight / 2 - layout.evolutionPanelCenterFromTop,
      layout.evolutionPanelHeight, highestLevel, model.unlockedCount, {
        isLocked: actions.isLocked,
        onCollection: actions.onCollection,
      });

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

  public refreshEvolution(board: BoardSnapshot, unlockedCount: number): void {
    this.evolution.refresh(this.highestLevel(board), unlockedCount);
  }

  public updateScore(score: number, highScore: number): void {
    this.scoreLabel = this.replaceHudValue(this.scoreLabel, String(score));
    this.highScoreLabel = this.replaceHudValue(this.highScoreLabel, String(highScore));
  }

  public clear(): void {
    this.scoreLabel = null;
    this.highScoreLabel = null;
    this.itemBar.clear();
    this.evolution.clear();
  }

  private createHudCard(titleText: string, valueText: string): { node: Node; value: Label } {
    const node = createUiNode(`Hud:${titleText}`, 190, 92);
    drawRounded(node, 190, 92, new Color(255, 248, 226, 240), 22, { color: COLORS.ink, width: 4 });
    const title = createLabel(titleText, 20, COLORS.teal, 160, 30, 'display');
    title.node.setPosition(0, 24);
    node.addChild(title.node);
    const value = this.createHudValue(valueText);
    value.node.setPosition(0, -15);
    node.addChild(value.node);
    return { node, value };
  }

  private createHudValue(valueText: string): Label {
    const value = createLabel(valueText, HUD_VALUE_FONT_SIZE, COLORS.ink, 178, 48, 'display', 'display');
    value.enableWrapText = false;
    value.overflow = Label.Overflow.CLAMP;
    return value;
  }

  private replaceHudValue(previous: Label | null, valueText: string): Label | null {
    const parent = previous?.node.parent;
    if (!previous || !parent) return previous;
    const value = this.createHudValue(valueText);
    value.node.setPosition(previous.node.position);
    parent.addChild(value.node);
    value.node.setSiblingIndex(previous.node.getSiblingIndex());
    previous.node.destroy();
    return value;
  }

  private highestLevel(board: BoardSnapshot): number {
    return board.tiles.reduce((highest, tile) => Math.max(highest, tile.level), 1);
  }
}
