/**
 * 棋盘棋子（Tile）渲染组件（从 BoardView 拆出）。
 * 含棋子节点对象池：复用节点树，避免频繁 create/destroy 造成的 GC 压力。
 *
 * 节点层级约定（固定命名，供复用时定位更新）：
 * Tile（根：位置/缩放动画）
 * ├─ Shadow   固定阴影（不随等级变化）
 * └─ Surface  等级底色 + 描边
 *    ├─ Halo  最高等级光环（始终创建，active 切换）
 *    ├─ Cat   等级立绘（Sprite 按等级换帧）
 *    └─ Badge 等级徽章（底色随等级段切换，内含 Label）
 */
import { Color, Label, Node, Sprite, tween, Tween, UITransform, Vec3 } from 'cc';
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
  setLabelText,
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
  readonly pool: TileNodePool;
}

/** 深度停止节点及所有后代的 tween（回收前必须调用，防止动画残留泄漏）。 */
function stopTweensDeeply(node: Node): void {
  Tween.stopAllByTarget(node);
  for (const child of node.children) stopTweensDeeply(child);
}

/**
 * 棋子节点对象池。
 * 棋子层级结构固定（Shadow/Surface/Halo/Cat/Badge），复用仅需按等级重绘
 * Graphics 与换 SpriteFrame，开销远小于整棵重建。
 */
export class TileNodePool {
  private readonly freeNodes: Node[] = [];

  public constructor(private readonly maxSize = 20) {}

  /** 获取棋子节点并挂载到 layer：优先复用池中节点，池空则全新构建。 */
  public acquire(tile: Tile, layer: Node,
    ctx: Pick<TileViewContext, 'art' | 'cosmetics' | 'positionFor'>): Node {
    let node = this.freeNodes.pop();
    if (!node || !node.isValid) {
      node = this.build(tile, ctx);
    } else {
      this.applyLevel(node, tile, ctx);
    }
    node.active = true;
    layer.addChild(node);
    return node;
  }

  /** 回收棋子节点：深度停止动画、复位变换后入池；池满则销毁。 */
  public release(node: Node | undefined | null): void {
    if (!node || !node.isValid) return;
    stopTweensDeeply(node);
    node.setPosition(0, 0, 0);
    node.setScale(1, 1, 1);
    node.setRotationFromEuler(0, 0, 0);
    node.removeFromParent();
    if (this.freeNodes.length < this.maxSize) this.freeNodes.push(node);
    else node.destroy();
  }

  /** 销毁池中所有空闲节点（页面卸载时调用）。 */
  public destroyAll(): void {
    for (const node of this.freeNodes) {
      if (node.isValid) node.destroy();
    }
    this.freeNodes.length = 0;
  }

  /** 全新构建一棵棋子节点树（结构固定，光环/Cat 容器始终存在）。 */
  private build(tile: Tile,
    ctx: Pick<TileViewContext, 'art' | 'cosmetics' | 'positionFor'>): Node {
    const node = createUiNode(`Tile:${tile.id}`, CELL_SIZE, CELL_SIZE);

    const shadow = createUiNode('Shadow', CELL_SIZE - 2, CELL_SIZE - 2);
    drawRounded(shadow, CELL_SIZE - 2, CELL_SIZE - 2, TILE_SHADOW, 22);
    shadow.setPosition(0, -3);
    node.addChild(shadow);

    const surface = createUiNode('Surface', CELL_SIZE, CELL_SIZE);
    node.addChild(surface);

    // 光环节点始终创建（复用时以 active 切换），保证子节点查找路径稳定。
    const haloFrame = ctx.art.frame(GAME_CONFIG.art.maxHalo);
    const halo = haloFrame
      ? createSpriteNode('Halo', haloFrame, CELL_SIZE * 1.08, CELL_SIZE * 1.08)
      : createUiNode('Halo', CELL_SIZE * 1.08, CELL_SIZE * 1.08);
    halo.active = false;
    surface.addChild(halo);

    // Cat 作为固定容器承载立绘，帧未就绪时隐藏容器而非移除节点。
    const cat = createUiNode('Cat', CELL_SIZE * 0.82, CELL_SIZE * 0.82);
    cat.setPosition(0, 8);
    surface.addChild(cat);

    const badge = createUiNode('Badge', 62, 28);
    badge.setPosition(0, -CELL_SIZE / 2 + 20);
    // Create the label with its real text and final font path. Creating it empty first
    // can leave Cocos with stale render data when applyLevel switches fonts immediately.
    const label = createLabel(`Lv.${tile.level}`, 17, COLORS.white, 58, 26,
      'display', 'number');
    label.node.name = 'LevelLabel';
    badge.addChild(label.node);
    surface.addChild(badge);

    this.applyLevel(node, tile, ctx);
    return node;
  }

  /** 按等级更新节点外观：底色、描边、光环、立绘与徽章。 */
  private applyLevel(node: Node,
    tile: Tile,
    ctx: Pick<TileViewContext, 'art' | 'cosmetics' | 'positionFor'>): void {
    node.name = `Tile:${tile.id}`;
    node.setPosition(ctx.positionFor(tile));

    const surface = node.getChildByName('Surface');
    if (!surface) return;
    drawRounded(surface, CELL_SIZE, CELL_SIZE, TILE_LEVEL_COLORS[tile.level - 1], 22,
      { color: TILE_BORDER, width: 2 });

    const isMaxLevel = tile.level === GAME_CONFIG.cats.length;
    const halo = surface.getChildByName('Halo');
    if (halo) {
      const haloReady = isMaxLevel && ctx.art.frame(GAME_CONFIG.art.maxHalo) !== undefined;
      halo.active = haloReady;
      if (haloReady) {
        // by 旋转从当前角度累加，重启前归零。
        halo.angle = 0;
        Tween.stopAllByTarget(halo);
        tween(halo).by(7, { angle: 360 }).repeatForever().start();
      }
    }

    const frame = ctx.cosmetics.catFrame(tile.level);
    const cat = surface.getChildByName('Cat');
    if (cat) {
      if (frame) {
        let sprite = cat.getComponent(Sprite);
        if (!sprite) sprite = cat.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        // 赋帧可能恢复导入尺寸，重新套用 UI 尺寸防止溢出。
        cat.getComponent(UITransform)?.setContentSize(CELL_SIZE * 0.82, CELL_SIZE * 0.82);
        cat.active = true;
      } else {
        cat.active = false;
      }
    }

    const badge = surface.getChildByName('Badge');
    if (badge) {
      drawRounded(badge, 62, 28, tile.level >= 8 ? COLORS.mustard : COLORS.teal, 14);
      const label = badge.getChildByName('LevelLabel')?.getComponent(Label);
      if (label) setLabelText(label, `Lv.${tile.level}`, 'display', 17, 'number');
    }
  }
}

/** 在指定层创建（或复用）棋子节点并注册到 tileNodes 映射。 */
export function createTileNode(tile: Tile, layer: Node, ctx: TileViewContext,
  tileNodes: Map<string, Node>): Node {
  const node = ctx.pool.acquire(tile, layer, ctx);
  tileNodes.set(tile.id, node);
  return node;
}

/** 播放一次合并动画：回收源棋子、创建结果棋子并播放闪光/爆炸特效。 */
export function playMergeAnimation(merge: MergeRecord, layer: Node, ctx: TileViewContext,
  tileNodes: Map<string, Node>): void {
  for (const id of merge.sourceIds) {
    const node = tileNodes.get(id);
    tileNodes.delete(id);
    ctx.pool.release(node);
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
