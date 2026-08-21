/**
 * 棋盘棋子（Tile）渲染组件（从 BoardView 拆出）。
 * 纯函数组件：创建单个棋子节点、播放合并特效。
 */
import { Color, Node, tween, Vec3 } from 'cc';
import type { MergeRecord, Position, Tile } from '../../../core/types';
import { GAME_CONFIG } from '../../../core/config/gameConfig';
import type { ArtRepository } from '../../utils/ArtRepository';
import type { CosmeticRuntime } from '../CosmeticRuntime';
import { CELL_SIZE } from '../../styles/boardGeometry';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../../utils/uiFactory';

/** 各等级棋子的底色（由样式定义）。 */
export const TILE_LEVEL_COLORS = [
  new Color(255, 240, 208, 255),
  new Color(224, 239, 240, 255),
  new Color(255, 224, 194, 255),
  new Color(231, 225, 242, 255),
  new Color(249, 221, 202, 255),
  new Color(230, 209, 174, 255),
  new Color(222, 231, 215, 255),
  new Color(218, 207, 228, 255),
  new Color(211, 202, 235, 255),
  new Color(198, 229, 229, 255),
  new Color(218, 207, 237, 255),
  new Color(250, 225, 166, 255),
] as const;

const TILE_BORDER = new Color(112, 75, 53, 145);
const TILE_SHADOW = new Color(91, 57, 39, 42);

export interface TileViewContext {
  readonly art: ArtRepository;
  readonly cosmetics: CosmeticRuntime;
  readonly positionFor: (position: Position) => Vec3;
}

/** 在指定层创建棋子节点并注册到 tileNodes 映射。 */
export function createTileNode(tile: Tile, layer: Node, ctx: TileViewContext,
  tileNodes: Map<string, Node>): Node {
  const node = createUiNode(`Tile:${tile.id}`, CELL_SIZE, CELL_SIZE);
  node.setPosition(ctx.positionFor(tile));
  layer.addChild(node);

  const shadow = createUiNode(`TileShadow:${tile.id}`, CELL_SIZE - 2, CELL_SIZE - 2);
  drawRounded(shadow, CELL_SIZE - 2, CELL_SIZE - 2, TILE_SHADOW, 22);
  shadow.setPosition(0, -3);
  node.addChild(shadow);

  const surface = createUiNode(`TileSurface:${tile.id}`, CELL_SIZE, CELL_SIZE);
  drawRounded(surface, CELL_SIZE, CELL_SIZE, TILE_LEVEL_COLORS[tile.level - 1], 22,
    { color: TILE_BORDER, width: 2 });
  node.addChild(surface);

  if (tile.level === GAME_CONFIG.cats.length) {
    const haloFrame = ctx.art.frame(GAME_CONFIG.art.maxHalo);
    if (haloFrame) {
      const halo = createSpriteNode('MaxLevelHalo', haloFrame, CELL_SIZE * 1.08, CELL_SIZE * 1.08);
      surface.addChild(halo);
      tween(halo).by(7, { angle: 360 }).repeatForever().start();
    }
  }
  const frame = ctx.cosmetics.catFrame(tile.level);
  if (frame) {
    const sprite = createSpriteNode(`Cat:${tile.level}`, frame, CELL_SIZE * 0.82, CELL_SIZE * 0.82);
    sprite.setPosition(0, 8);
    surface.addChild(sprite);
  }
  const badge = createUiNode('LevelBadge', 62, 28);
  drawRounded(badge, 62, 28, tile.level >= 8 ? COLORS.mustard : COLORS.teal, 14);
  badge.setPosition(0, -CELL_SIZE / 2 + 20);
  const label = createLabel(`Lv.${tile.level}`, 17, COLORS.white, 58, 26, 'display');
  badge.addChild(label.node);
  surface.addChild(badge);
  tileNodes.set(tile.id, node);
  return node;
}

/** 播放一次合并动画：销毁源棋子、创建结果棋子并播放闪光/爆炸特效。 */
export function playMergeAnimation(merge: MergeRecord, layer: Node, ctx: TileViewContext,
  tileNodes: Map<string, Node>): void {
  for (const id of merge.sourceIds) {
    tileNodes.get(id)?.destroy();
    tileNodes.delete(id);
  }
  const resultTile: Tile = {
    id: merge.resultId,
    level: merge.level,
    row: merge.at.row,
    col: merge.at.col,
  };
  const node = createTileNode(resultTile, layer, ctx, tileNodes);
  node.setScale(0.84, 0.84, 1);
  tween(node).to(0.1, { scale: new Vec3(1.12, 1.12, 1) }).to(0.1, { scale: Vec3.ONE }).start();
  const sparkleFrame = ctx.cosmetics.mergeSparkleFrame();
  if (sparkleFrame) {
    const sparkle = createSpriteNode('MergeSparkle', sparkleFrame, CELL_SIZE * 1.35, CELL_SIZE * 1.35);
    sparkle.setPosition(ctx.positionFor(merge.at));
    sparkle.setScale(0.4, 0.4, 1);
    layer.addChild(sparkle);
    tween(sparkle).to(0.1, { scale: Vec3.ONE }).to(0.1, { scale: new Vec3(1.25, 1.25, 1) }).call(() => sparkle.destroy()).start();
  }
  const burstFrame = ctx.cosmetics.mergeBurstFrame();
  if (burstFrame) {
    const burst = createSpriteNode('MergeBurst', burstFrame, CELL_SIZE * 1.75, CELL_SIZE * 1.75);
    burst.setPosition(ctx.positionFor(merge.at));
    burst.setScale(0.2, 0.2, 1);
    layer.addChild(burst);
    burst.setSiblingIndex(Math.max(0, burst.getSiblingIndex() - 1));
    tween(burst).to(0.14, { scale: Vec3.ONE }).to(0.16, { scale: new Vec3(1.25, 1.25, 1) })
      .call(() => burst.destroy()).start();
  }
}
