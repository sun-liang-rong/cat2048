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
  new Color(255, 235, 195, 255),  // Lv1: 更鲜明的奶黄色
  new Color(180, 210, 230, 255),  // Lv2: 更饱和的蓝白色
  new Color(255, 195, 135, 255),  // Lv3: 更明亮的橙色
  new Color(210, 215, 235, 255),  // Lv4: 更清晰的淡紫色
  new Color(245, 205, 160, 255),  // Lv5: 更温暖的米色
  new Color(200, 160, 100, 255),  // Lv6: 更深的棕色
  new Color(220, 220, 210, 255),  // Lv7: 更明显的灰白色
  new Color(70, 65, 75, 255),     // Lv8: 保持深色
  new Color(95, 75, 170, 255),    // Lv9: 更鲜艳的紫色
  new Color(95, 165, 185, 255),   // Lv10: 更清晰的青色
  new Color(110, 85, 175, 255),   // Lv11: 更饱和的紫色
  new Color(220, 165, 60, 255),   // Lv12: 更金黄的色调
] as const;

export interface TileViewContext {
  readonly art: ArtRepository;
  readonly cosmetics: CosmeticRuntime;
  readonly positionFor: (position: Position) => Vec3;
}

/** 在指定层创建棋子节点并注册到 tileNodes 映射。 */
export function createTileNode(tile: Tile, layer: Node, ctx: TileViewContext,
  tileNodes: Map<string, Node>): Node {
  const node = createUiNode(`Tile:${tile.id}`, CELL_SIZE, CELL_SIZE);
  // 统一圆角24px，增强边框到4px，低等级方块使用更明显的边框
  const borderWidth = tile.level <= 4 ? 4 : 4;
  drawRounded(node, CELL_SIZE, CELL_SIZE, TILE_LEVEL_COLORS[tile.level - 1], 24,
    { color: COLORS.ink, width: borderWidth });
  node.setPosition(ctx.positionFor(tile));
  layer.addChild(node);

  const cat = GAME_CONFIG.cats[tile.level - 1];
  if (tile.level === GAME_CONFIG.cats.length) {
    const haloFrame = ctx.art.frame(GAME_CONFIG.art.maxHalo);
    if (haloFrame) {
      const halo = createSpriteNode('MaxLevelHalo', haloFrame, CELL_SIZE * 1.08, CELL_SIZE * 1.08);
      node.addChild(halo);
      tween(halo).by(7, { angle: 360 }).repeatForever().start();
    }
  }
  const frame = ctx.cosmetics.catFrame(tile.level);
  if (frame) {
    const sprite = createSpriteNode(`Cat:${tile.level}`, frame, CELL_SIZE * 0.78, CELL_SIZE * 0.78);
    sprite.setPosition(0, 10);
    node.addChild(sprite);
  }
  const badge = createUiNode('LevelBadge', 72, 34);
  drawRounded(badge, 72, 34, tile.level >= 8 ? COLORS.mustard : COLORS.teal, 17);
  badge.setPosition(0, -CELL_SIZE / 2 + 23);
  const label = createLabel(`Lv${tile.level}`, 20, COLORS.white, 68, 30, 'display');
  badge.addChild(label.node);
  node.addChild(badge);
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
