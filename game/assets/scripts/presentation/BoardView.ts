import { Color, Node, tween, Tween, Vec3 } from 'cc';
import type { BoardSnapshot, MergeRecord, MoveResult, Position, Tile } from '../core/types';
import { GAME_CONFIG } from '../infrastructure/gameConfig';
import type { ArtRepository } from './ArtRepository';
import type { CosmeticRuntime } from './CosmeticRuntime';
import {
  BOARD_PADDING,
  BOARD_PIXELS,
  CELL_GAP,
  CELL_SIZE,
  cellCenter,
} from './boardGeometry';
import {
  tweenOpacity,
  tweenPosition,
  tweenScale,
} from './tweenAsync';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from './uiFactory';

export interface BoardFeedback {
  onMerge(): void;
  onMove(): void;
}

function delay(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
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
    else drawRounded(board, boardPixels, boardPixels, new Color(189, 139, 82, 255), 38);

    const shade = createUiNode('BoardShade', boardPixels - 18, boardPixels - 18);
    drawRounded(shade, boardPixels - 18, boardPixels - 18, new Color(79, 48, 29, 48), 32);
    board.addChild(shade);

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
      const node = this.createTileNode(tile);
      node.setScale(0.2, 0.2, 1);
      tween(node).delay(tile.col * 0.03).to(0.15, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    });
  }

  public rebuild(snapshot: BoardSnapshot, animate = true): void {
    if (!this.tileLayer) return;
    for (const child of [...this.tileLayer.children]) child.destroy();
    this.tileNodes.clear();
    snapshot.tiles.forEach((tile) => {
      const node = this.createTileNode(tile);
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
    if (result.merges.length > 0) await delay(GAME_CONFIG.mergeSeconds);
    if (!isAlive()) return;

    if (result.spawned) {
      const node = this.createTileNode(result.spawned.tile);
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
    for (const id of merge.sourceIds) {
      this.tileNodes.get(id)?.destroy();
      this.tileNodes.delete(id);
    }
    const resultTile: Tile = {
      id: merge.resultId,
      level: merge.level,
      row: merge.at.row,
      col: merge.at.col,
    };
    const node = this.createTileNode(resultTile);
    node.setScale(0.84, 0.84, 1);
    tween(node).to(0.1, { scale: new Vec3(1.12, 1.12, 1) }).to(0.1, { scale: Vec3.ONE }).start();
    const sparkleFrame = this.cosmetics.mergeSparkleFrame();
    if (sparkleFrame && this.tileLayer) {
      const sparkle = createSpriteNode('MergeSparkle', sparkleFrame, CELL_SIZE * 1.35, CELL_SIZE * 1.35);
      sparkle.setPosition(this.positionFor(merge.at));
      sparkle.setScale(0.4, 0.4, 1);
      this.tileLayer.addChild(sparkle);
      tween(sparkle).to(0.1, { scale: Vec3.ONE }).to(0.1, { scale: new Vec3(1.25, 1.25, 1) }).call(() => sparkle.destroy()).start();
    }
    const burstFrame = this.cosmetics.mergeBurstFrame();
    if (burstFrame && this.tileLayer) {
      const burst = createSpriteNode('MergeBurst', burstFrame, CELL_SIZE * 1.75, CELL_SIZE * 1.75);
      burst.setPosition(this.positionFor(merge.at));
      burst.setScale(0.2, 0.2, 1);
      this.tileLayer.addChild(burst);
      burst.setSiblingIndex(Math.max(0, burst.getSiblingIndex() - 1));
      tween(burst).to(0.14, { scale: Vec3.ONE }).to(0.16, { scale: new Vec3(1.25, 1.25, 1) })
        .call(() => burst.destroy()).start();
    }
  }

  private createTileNode(tile: Tile): Node {
    if (!this.tileLayer) throw new Error('Tile layer is not initialized.');
    const node = createUiNode(`Tile:${tile.id}`, CELL_SIZE, CELL_SIZE);
    const colors = [COLORS.cream, new Color(194, 219, 226, 255), new Color(252, 209, 155, 255),
      new Color(220, 224, 232, 255), new Color(241, 214, 174, 255), new Color(214, 172, 115, 255),
      new Color(231, 230, 218, 255), new Color(78, 72, 79, 255), new Color(106, 84, 181, 255)];
    drawRounded(node, CELL_SIZE, CELL_SIZE, colors[tile.level - 1], 24, { color: COLORS.ink, width: 3 });
    node.setPosition(this.positionFor(tile));
    this.tileLayer.addChild(node);

    const cat = GAME_CONFIG.cats[tile.level - 1];
    if (tile.level === GAME_CONFIG.cats.length) {
      const haloFrame = this.art.frame(GAME_CONFIG.art.maxHalo);
      if (haloFrame) {
        const halo = createSpriteNode('MaxLevelHalo', haloFrame, CELL_SIZE * 1.08, CELL_SIZE * 1.08);
        node.addChild(halo);
        tween(halo).by(7, { angle: 360 }).repeatForever().start();
      }
    }
    const frame = this.cosmetics.catFrame(tile.level);
    if (frame) {
      const sprite = createSpriteNode(`Cat:${tile.level}`, frame, CELL_SIZE * 0.78, CELL_SIZE * 0.78);
      sprite.setPosition(0, 10);
      node.addChild(sprite);
    }
    const badge = createUiNode('LevelBadge', 64, 30);
    drawRounded(badge, 64, 30, tile.level >= 8 ? COLORS.mustard : COLORS.teal, 14);
    badge.setPosition(0, -CELL_SIZE / 2 + 21);
    const label = createLabel(`Lv${tile.level}`, 18, COLORS.white, 60, 27, 'display');
    badge.addChild(label.node);
    node.addChild(badge);
    this.tileNodes.set(tile.id, node);
    return node;
  }
}
