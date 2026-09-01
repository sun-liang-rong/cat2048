import { Color, Graphics, Mask, Node, tween, Tween, Vec3 } from 'cc';
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
import { createTileNode, playMergeAnimation, TileNodePool } from './board/TileView';

/** 棋盘背景外轮廓圆角（与格子 22 同级，略大以体现由外到内的收束）。 */
const BOARD_CORNER_RADIUS = 30;

export interface BoardFeedback {
  onMerge(): void;
  onMove(): void;
}

export class BoardView {
  private boardRoot: Node | null = null;
  private tileLayer: Node | null = null;
  private tileNodes = new Map<string, Node>();
  private touchHighlight: Node | null = null;
  private itemSuccessBaseScale: Vec3 | null = null;
  /** 棋子节点对象池：棋盘最多 16 格，池容量留出合并动画过渡的余量。 */
  private readonly tilePool = new TileNodePool(20);

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

    // 背景图用圆角模板直接裁出外轮廓（切图自身圆角偏小且带直角边）。
    const background = createUiNode('BoardBackground', boardPixels, boardPixels);
    const stencil = background.addComponent(Mask);
    stencil.type = Mask.Type.GRAPHICS_STENCIL;
    const graphics = background.getComponent(Graphics)!;
    graphics.roundRect(-boardPixels / 2, -boardPixels / 2, boardPixels, boardPixels,
      BOARD_CORNER_RADIUS);
    graphics.fill();
    board.addChild(background);

    const boardFrame = this.cosmetics.boardFrame();
    if (boardFrame) {
      background.addChild(createSpriteNode('BoardBackground:Art', boardFrame,
        boardPixels, boardPixels));
    } else {
      const fallback = createUiNode('BoardBackground:Fallback', boardPixels, boardPixels);
      drawRounded(fallback, boardPixels, boardPixels, new Color(224, 172, 100, 255),
        BOARD_CORNER_RADIUS);
      background.addChild(fallback);
    }

    this.createGrid(board);
    this.tileLayer = createUiNode('Tiles', boardPixels, boardPixels);
    board.addChild(this.tileLayer);
    return board;
  }

  public unmount(): void {
    this.clearTouchHighlight();
    if (this.boardRoot) Tween.stopAllByTarget(this.boardRoot);
    this.itemSuccessBaseScale = null;
    // 停止所有瓦片节点的动画
    if (this.tileLayer) {
      this.tileLayer.children.forEach(child => {
        Tween.stopAllByTarget(child);
      });
    }
    this.tileNodes.clear();
    this.tileLayer = null;
    this.boardRoot = null;
    // 销毁对象池中的空闲节点
    this.tilePool.destroyAll();
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
    // 回收所有节点到对象池（release 内部会停止动画并从父节点移除）
    const children = this.tileLayer.children;
    for (let i = children.length - 1; i >= 0; i--) {
      this.tilePool.release(children[i]);
    }
    this.tileNodes.clear();
    // 从池中取用或创建新节点
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
      await tweenScale(node, Vec3.ONE, GAME_CONFIG.spawnSeconds);
    }
  }

  public async animateRemove(tileIds: readonly string[], isAlive: () => boolean): Promise<void> {
    for (const tileId of tileIds) {
      const node = this.tileNodes.get(tileId);
      if (!node) continue;
      await tweenScale(node, new Vec3(0.08, 0.08, 1), 0.1);
      this.tileNodes.delete(tileId);
      this.tilePool.release(node);
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

  /** 道具成功后的短促棋盘反馈，避免用户只看到按钮库存变化。 */
  public playItemSuccess(): void {
    const board = this.boardRoot;
    if (!board || !board.isValid) return;
    if (this.itemSuccessBaseScale) board.setScale(this.itemSuccessBaseScale);
    const base = board.scale.clone();
    this.itemSuccessBaseScale = base;
    Tween.stopAllByTarget(board);
    tween(board)
      .to(0.08, { scale: new Vec3(base.x * 1.045, base.y * 1.045, base.z) }, { easing: 'quadOut' })
      .to(0.12, { scale: base }, { easing: 'quadIn' })
      .call(() => {
        if (this.boardRoot === board) this.itemSuccessBaseScale = null;
      })
      .start();
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
      pool: this.tilePool,
    };
  }
}
