import { Color, Node, tween, Tween, Vec3 } from 'cc';
import type { BoardSnapshot, MergeRecord, MoveResult, Position, Tile } from '../../core/types';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import type { CosmeticRuntime } from './CosmeticRuntime';
import {
  BOARD_PADDING,
  BOARD_PIXELS,
  CELL_GAP,
  CELL_SIZE,
  cellCenter,
} from '../styles/boardGeometry';
import {
  tweenDelay,
  tweenOpacity,
  tweenPosition,
  tweenScale,
} from '../utils/tweenAsync';
import {
  COLORS,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';
import { createTileNode, playMergeAnimation } from './board/TileView';

export interface BoardFeedback {
  onMerge(): void;
  onMove(): void;
}

export class BoardView {
  private boardRoot: Node | null = null;
  private tileLayer: Node | null = null;
  private tileNodes = new Map<string, Node>();
  private touchHighlight: Node | null = null;

  public constructor(private readonly art: ArtRepository, private readonly cosmetics: CosmeticRuntime) {}

  /** Root board node (scaled/positioned by Boot or GameScreen). Null until mount. */
  public get root(): Node | null {
    return this.boardRoot;
  }

  public mount(parent: Node, boardPixels: number): Node {
    this.clearTouchHighlight();
    const board = createUiNode('Board', boardPixels, boardPixels);
    parent.addChild(board);
    this.boardRoot = board;

    const boardFrame = this.cosmetics.boardFrame();
    if (boardFrame) board.addChild(createSpriteNode('BoardBackground', boardFrame, boardPixels, boardPixels));
    else drawRounded(board, boardPixels, boardPixels, new Color(224, 172, 100, 255), 38);

    this.createGrid(board);
    this.tileLayer = createUiNode('Tiles', boardPixels, boardPixels);
    board.addChild(this.tileLayer);
    return board;
  }

  public unmount(): void {
    this.clearTouchHighlight();
    this.tileNodes.clear();
    this.tileLayer = null;
    this.boardRoot = null;
  }

  public renderInitial(snapshot: BoardSnapshot): void {
    this.tileNodes.clear();
    snapshot.tiles.forEach((tile) => {
      const node = createTileNode(tile, this.tileLayer!, this.tileContext(), this.tileNodes);
      node.setScale(0.2, 0.2, 1);
      tween(node).delay(tile.col * 0.03).to(0.15, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    });
  }

  public rebuild(snapshot: BoardSnapshot, animate = true): void {
    if (!this.tileLayer) return;
    for (const child of [...this.tileLayer.children]) child.destroy();
    this.tileNodes.clear();
    snapshot.tiles.forEach((tile) => {
      const node = createTileNode(tile, this.tileLayer!, this.tileContext(), this.tileNodes);
      if (animate) {
        node.setScale(0.2, 0.2, 1);
        tween(node).to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
      }
    });
  }

  public async animateMove(
    result: MoveResult,
    isAlive: () => boolean,
    feedback: BoardFeedback,
  ): Promise<void> {
    const animations = result.motions.map((motion) => {
      const node = this.tileNodes.get(motion.tileId);
      if (!node) return Promise.resolve();
      return tweenPosition(node, this.positionFor(motion.to), GAME_CONFIG.moveSeconds);
    });
    await Promise.all(animations);
    if (!isAlive()) return;

    if (result.merges.length > 0) feedback.onMerge();
    else feedback.onMove();

    for (const merge of result.merges) this.finishMerge(merge);
    if (result.merges.length > 0 && this.boardRoot) await tweenDelay(this.boardRoot, GAME_CONFIG.mergeSeconds);
    if (!isAlive()) return;

    if (result.spawned) {
      const node = createTileNode(result.spawned.tile, this.tileLayer!, this.tileContext(), this.tileNodes);
      node.setScale(0.2, 0.2, 1);
      await tweenScale(node, Vec3.ONE, 0.12);
    }
  }

  public async animateRemove(tileIds: readonly string[], isAlive: () => boolean): Promise<void> {
    for (const tileId of tileIds) {
      const node = this.tileNodes.get(tileId);
      if (!node) continue;
      await tweenScale(node, new Vec3(0.08, 0.08, 1), 0.1);
      node.destroy();
      this.tileNodes.delete(tileId);
      if (!isAlive()) return;
    }
  }

  public async fadeRebuild(snapshot: BoardSnapshot, isAlive: () => boolean): Promise<void> {
    const layer = this.tileLayer;
    if (!layer) return;
    await tweenOpacity(layer, 50, 0.1);
    if (!isAlive() || !this.tileLayer) return;
    this.rebuild(snapshot, false);
    await tweenOpacity(layer, 255, 0.14);
  }

  public positionFor(position: Position): Vec3 {
    const { x, y } = cellCenter(position);
    return new Vec3(x, y, 0);
  }

  public showTouchHighlight(eventLocalX: number, eventLocalY: number): void {
    const board = this.boardRoot;
    if (!board) return;
    const start = -BOARD_PIXELS / 2 + BOARD_PADDING;
    const step = CELL_SIZE + CELL_GAP;
    const col = Math.max(0, Math.min(3, Math.floor((eventLocalX - start) / step)));
    const row = Math.max(0, Math.min(3, Math.floor((-eventLocalY - start) / step)));
    const position = this.positionFor({ row, col });

    // Reuse one highlight node so cancel/start thrashing does not create/destroy sprites.
    let highlight = this.touchHighlight;
    if (!highlight || !highlight.isValid) {
      const frame = this.art.frame(GAME_CONFIG.art.tileSelected);
      if (!frame) return;
      highlight = createSpriteNode('TouchHighlight', frame, CELL_SIZE * 1.12, CELL_SIZE * 1.12);
      board.addChild(highlight);
      this.touchHighlight = highlight;
    } else if (highlight.parent !== board) {
      board.addChild(highlight);
    }

    Tween.stopAllByTarget(highlight);
    highlight.active = true;
    highlight.setPosition(position);
    highlight.setScale(1, 1, 1);
    highlight.setSiblingIndex(board.children.length - 1);
    tween(highlight).to(0.12, { scale: new Vec3(1.06, 1.06, 1) }).start();
  }

  public clearTouchHighlight(): void {
    const highlight = this.touchHighlight;
    if (!highlight) {
      this.boardRoot?.getChildByName('TouchHighlight')?.destroy();
      return;
    }
    if (highlight.isValid) {
      Tween.stopAllByTarget(highlight);
      highlight.destroy();
    }
    this.touchHighlight = null;
  }

  private createGrid(board: Node): void {
    const frame = this.art.frame(GAME_CONFIG.art.tileBase);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const cell = frame
          ? createSpriteNode(`Cell:${row}:${col}`, frame, CELL_SIZE, CELL_SIZE)
          : createUiNode(`Cell:${row}:${col}`, CELL_SIZE, CELL_SIZE);
        if (!frame) drawRounded(cell, CELL_SIZE, CELL_SIZE, COLORS.cell, 24);
        cell.setPosition(this.positionFor({ row, col }));
        board.addChild(cell);
      }
    }
  }

  private finishMerge(merge: MergeRecord): void {
    if (!this.tileLayer) return;
    playMergeAnimation(merge, this.tileLayer, this.tileContext(), this.tileNodes);
  }

  private tileContext(): Parameters<typeof createTileNode>[2] {
    return {
      art: this.art,
      cosmetics: this.cosmetics,
      positionFor: (position) => this.positionFor(position),
    };
  }
}
