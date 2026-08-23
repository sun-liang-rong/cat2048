/**
 * 猫咪图鉴详情弹窗：图鉴页点击卡片时弹出，展示猫咪图片与简介。
 *
 * 设计要点：
 * - 复用 `ModalView` 统一风格（圆角 + 关闭按钮 + 标题装饰）。
 * - 已解锁：展示大图 + 名称 + Lv + 简介 + 合成得分。
 * - 未解锁：展示剪影图 + 名称（灰）+ "未解锁" 提示 + 上一等级的合成提示文案。
 *   该弹窗不影响经济 / 存档，宿主负责 `lockInput` / `unlockInput`。
 */
import { Color, Node } from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import type { CosmeticRuntime } from '../components/CosmeticRuntime';
import {
  COLORS,
  createLabel,
  createSpriteNode,
} from '../utils/uiFactory';
import { ModalView, MODAL_TITLE } from './ModalView';

type CatDefinition = (typeof GAME_CONFIG.cats)[number];

export interface CatDetailModalActions {
  readonly onClose: () => void;
}

const PANEL_WIDTH = 580;
const PANEL_HEIGHT = 700;
const IMAGE_SIZE = 320;
const LOCKED_TEXT_COLOR = COLORS.textLocked;
const HINT_COLOR = new Color(120, 96, 76, 255); // 详情提示文字
const NAME_COLOR = COLORS.heading;

export class CatDetailModal {
  private readonly modal: ModalView;

  public constructor(
    private readonly art: ArtRepository,
    private readonly cosmetics: CosmeticRuntime,
  ) {
    this.modal = new ModalView(art, () => ({ width: 0, height: 0 }));
  }

  /**
   * 打开图鉴详情弹窗。
   *
   * @param parent  弹窗挂载的屏幕根节点
   * @param cat     猫咪定义
   * @param unlocked  是否已解锁
   * @param overlayWidth / overlayHeight  透传当前屏幕尺寸（用于遮罩铺满）
   * @param actions 关闭回调
   */
  public show(parent: Node, cat: CatDefinition, unlocked: boolean,
    overlayWidth: number, overlayHeight: number,
    actions: CatDetailModalActions): Node {
    const { overlay, panel } = this.modal.open(parent, {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      overlayWidth,
      overlayHeight,
      title: unlocked ? cat.name : '???',
      // 详情弹窗正文是图片 + 简介，不需要顶部爪印 / 圆点装饰，避免视觉拥挤。
      topDecoration: false,
      titleDots: false,
      bottomDecoration: false,
      onClose: actions.onClose,
    });

    this.renderImage(panel, cat, unlocked);
    this.renderMeta(panel, cat, unlocked);
    return overlay;
  }

  private renderImage(panel: Node, cat: CatDefinition, unlocked: boolean): void {
    const frame = unlocked
      ? this.cosmetics.catFrame(cat.level)
      : this.art.frame(GAME_CONFIG.art.collectionLockedCat);
    if (frame) {
      const image = createSpriteNode(`CatDetail:${cat.level}:Image`, frame, IMAGE_SIZE, IMAGE_SIZE);
      image.setPosition(0, 90);
      panel.addChild(image);
    }
  }

  private renderMeta(panel: Node, cat: CatDefinition, unlocked: boolean): void {
    const level = createLabel(`Lv.${cat.level}`, 30,
      unlocked ? NAME_COLOR : LOCKED_TEXT_COLOR,
      360, 44, 'display');
    level.node.setPosition(0, -135);
    panel.addChild(level.node);

    if (unlocked) {
      const description = createLabel(cat.description, 24, HINT_COLOR, 460, 120, 'body');
      description.node.setPosition(0, -215);
      panel.addChild(description.node);
      const score = createLabel(`合并得分：${cat.level >= 2 ? Math.pow(2, cat.level) : 2}`, 22,
        COLORS.teal, 460, 36, 'display');
      score.node.setPosition(0, -288);
      panel.addChild(score.node);
      return;
    }

    const locked = createLabel('尚未解锁', 26, LOCKED_TEXT_COLOR, 360, 40, 'display');
    locked.node.setPosition(0, -200);
    panel.addChild(locked.node);
    const hint = cat.level === 1
      ? createLabel('Lv.1 橘猫开局即出现，开始游戏即可遇见', 22, HINT_COLOR, 460, 80, 'body')
      : createLabel(`合成两只 Lv.${cat.level - 1} 猫咪即可解锁`, 22, HINT_COLOR, 460, 80, 'body');
    hint.node.setPosition(0, -260);
    panel.addChild(hint.node);
  }
}

// Re-export MODAL_TITLE for tests that may want to assert the palette match.
export { MODAL_TITLE };