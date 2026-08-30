import { Color, Label, Node } from 'cc';
import type { ArtRepository } from '../utils/ArtRepository';
import { ModalView, MODAL_CARD } from './ModalView';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import {
  COLORS,
  createLabel,
  createSpriteNode,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';

export interface GuidePanelHandlers {
  onClose(): void;
}

const PANEL_WIDTH = 680;
// 780 为精确配平值：ModalView 标题钉在 232×(H/620)，字形底部 ≈266；
// 需容纳 标题间隙16 + 四行(118)与18px行距 + 底部装饰带94与20px净空，
// 更矮的面板会让首行卡片叠住标题字形（行后绘制、渲染在标题之上）。
const PANEL_HEIGHT = 780;
const ROW_WIDTH = 600;
// 行内纵向：标题字形 30 + 间隙 12 + 两行描述 54，上下各留 11px 内边距
const ROW_HEIGHT = 118;
const ROW_RADIUS = 32;
const ROW_EDGE = new Color(246, 231, 204, 255);
/** 四行介绍统一主题青色图标底，与设置弹窗一致，同级内容不做多彩区分。 */
const ICON_BACKGROUND = new Color(101, 190, 177, 255);
const TITLE_COLOR = new Color(91, 53, 39, 255);

interface GuideSection {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  /** taskIcons 键名；coin 行使用彩色金币素材，不走白色字形。 */
  readonly icon: 'star' | 'bolt' | 'coin' | 'play';
}

const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    name: 'Merge',
    title: '猫咪合成',
    description: '上下左右滑动，相同猫咪相遇合成升级\n一路合到 12 级创世极光猫',
    icon: 'star',
  },
  {
    name: 'Items',
    title: '对局道具',
    description: '撤回、消除等道具每局限用 2 次\n消除会移除等级最低的猫咪',
    icon: 'bolt',
  },
  {
    name: 'Coins',
    title: '猫爪金币',
    description: '对局结算、每日签到、每日任务都能赚金币\n商店可购买猫咪皮肤与棋盘装扮',
    icon: 'coin',
  },
  {
    name: 'Daily',
    title: '每日目标',
    description: '每日挑战 00:00 刷新，合成 Lv.5 即完成\n图鉴收录 12 只猫咪等你集齐',
    icon: 'play',
  },
];

export class GuidePanelView {
  private readonly modal: ModalView;

  public constructor(
    getSize: () => { width: number; height: number },
    private readonly art: ArtRepository,
  ) {
    this.modal = new ModalView(art, getSize);
  }

  public show(parent: Node, handlers: GuidePanelHandlers): void {
    const { panel } = this.modal.open(parent, {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      title: '玩法介绍',
      onClose: handlers.onClose,
    });

    // 首行顶部(250)与标题字形底部(266)保持 16px；末行距底部装饰带 20px
    const rowPositions = [191, 55, -81, -217];
    GUIDE_SECTIONS.forEach((section, index) => {
      this.addSectionRow(panel, section, rowPositions[index]);
    });
  }

  private addSectionRow(parent: Node, section: GuideSection, y: number): void {
    const shadow = createUiNode(`Guide${section.name}Shadow`, ROW_WIDTH + 4, ROW_HEIGHT + 8);
    drawRounded(shadow, ROW_WIDTH + 4, ROW_HEIGHT + 8,
      new Color(221, 190, 144, 42), ROW_RADIUS + 2);
    shadow.setPosition(0, y - 5);
    parent.addChild(shadow);

    const row = createUiNode(`Guide${section.name}Row`, ROW_WIDTH, ROW_HEIGHT);
    drawRounded(row, ROW_WIDTH, ROW_HEIGHT, MODAL_CARD, ROW_RADIUS,
      { color: ROW_EDGE, width: 2 });
    row.setPosition(0, y);
    parent.addChild(row);

    const icon = createUiNode(`Guide${section.name}Icon`, 66, 66);
    drawRounded(icon, 66, 66, ICON_BACKGROUND, 33,
      { color: new Color(255, 255, 255, 92), width: 2 });
    icon.setPosition(-239, 0);
    row.addChild(icon);

    // 金币为彩色素材直接展示；其余是 Remix Icon 白色字形（与任务图标同一生成管线）。
    const frame = section.icon === 'coin'
      ? this.art.frame(GAME_CONFIG.art.coin)
      : this.art.frame(GAME_CONFIG.art.taskIcons[section.icon]);
    if (frame) {
      const glyph = createSpriteNode(`Guide${section.name}Glyph`, frame, 46, 46);
      icon.addChild(glyph);
    }

    const title = createLabel(section.title, 26, TITLE_COLOR, 300, 30, 'display');
    title.lineHeight = 30;
    title.horizontalAlign = Label.HorizontalAlign.LEFT;
    title.node.setPosition(-20, 33);
    row.addChild(title.node);

    const description = createLabel(section.description, 20, COLORS.textMuted, 440, 54, 'body');
    description.lineHeight = 27;
    description.horizontalAlign = Label.HorizontalAlign.LEFT;
    // 标题字形底部(y=18)与描述首行顶部(y=6)之间固定 12px 间隙
    description.node.setPosition(48, -21);
    row.addChild(description.node);
  }
}
