import {
  BlockInputEvents,
  Color,
  Graphics,
  Mask,
  Node,
  tween,
  UIOpacity,
  Vec3,
} from 'cc';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { ArtRepository } from '../utils/ArtRepository';
import {
  COLORS,
  createButton,
  createIconButton,
  createLabel,
  createPillButton,
  createUiNode,
  drawRounded,
} from '../utils/uiFactory';
import { addBottomDecoration, addTitleDots, addTopDecoration } from './modalDecorations';

/** 主、次按钮可按当前操作语义交换强调层级。 */
export interface DialogActions {
  readonly onConfirm: () => void;
  readonly onCancel?: () => void;
  readonly cancelTone?: 'primary' | 'secondary';
  readonly confirmTone?: 'primary' | 'secondary';
  readonly showClose?: boolean;
  readonly auxiliary?: {
    readonly text: string;
    readonly onTap: () => void;
  };
}

export interface ModalOpenOptions {
  readonly width: number;
  readonly height: number;
  /** 遮罩层尺寸；缺省时使用构造时传入的 getSize()。 */
  readonly overlayWidth?: number;
  readonly overlayHeight?: number;
  readonly title?: string;
  readonly titleSize?: number;
  readonly titleColor?: Color;
  readonly radius?: number;
  /** 默认 true，右上角显示关闭按钮。 */
  readonly showClose?: boolean;
  readonly closeSize?: number;
  readonly scaleFrom?: number;
  /** 顶部标题两侧的装饰（爪印与叶片），默认 true。 */
  readonly topDecoration?: boolean;
  /** 标题下方的圆点装饰，默认 true。 */
  readonly titleDots?: boolean;
  /** 底部山丘与植物装饰，默认 true。 */
  readonly bottomDecoration?: boolean;
  /** 弹窗被关闭（关闭按钮 / 取消）时触发。 */
  readonly onClose?: () => void;
}

export interface ModalHandle {
  readonly overlay: Node;
  readonly panel: Node;
  /** 关闭并销毁弹窗，触发 onClose 回调。 */
  readonly close: () => void;
}

/** 弹窗面板统一色板（与首页“设置”弹窗保持一致）。 */
export const MODAL_FILL = new Color(255, 249, 233, 255);
export const MODAL_EDGE = new Color(238, 216, 181, 255);
export const MODAL_SHADOW = new Color(58, 40, 30, 82);
export const MODAL_TITLE = new Color(91, 53, 39, 255);
/** 弹窗内行/卡片的统一底色（设置与任务弹窗的行共用）。 */
export const MODAL_CARD = new Color(255, 252, 244, 255);

// 装饰参考尺寸：以首页“设置”弹窗（680×620）为基准，其他弹窗按比例缩放。
const REFERENCE_WIDTH = 680;
const REFERENCE_HEIGHT = 620;

/**
 * 项目统一的弹窗组件：遮罩、圆角面板、关闭按钮、标题与装饰全部封装在这里。
 *
 * 关键点：面板使用自绘圆角矩形（Graphics）作为 GRAPHICS_STENCIL 模板遮罩，
 * 所有子节点（包括底部山丘装饰）都会被裁剪进圆角范围内，
 * 从而保证弹窗四个角（尤其是底部两个角）始终是圆角。
 */
export class ModalView {
  public constructor(
    private readonly art: ArtRepository,
    private readonly getSize: () => { width: number; height: number },
  ) {}

  /** 打开统一风格弹窗骨架，返回面板节点供调用方填充内容。 */
  public open(parent: Node, options: ModalOpenOptions): ModalHandle {
    const { width: overlayWidth, height: overlayHeight } = this.getSize();
    const width = options.overlayWidth ?? overlayWidth;
    const height = options.overlayHeight ?? overlayHeight;
    const radius = options.radius ?? 42;

    const overlay = createUiNode('ModalOverlay', width, height);
    overlay.addComponent(BlockInputEvents);
    const dim = overlay.addComponent(Graphics);
    dim.fillColor = COLORS.overlay;
    dim.rect(-width / 2, -height / 2, width, height);
    dim.fill();
    parent.addChild(overlay);

    let dismissed = false;
    const close = (): void => {
      if (dismissed) return;
      dismissed = true;
      overlay.destroy();
      options.onClose?.();
    };

    const panelWidth = options.width;
    const panelHeight = options.height;
    const sx = panelWidth / REFERENCE_WIDTH;
    const sy = panelHeight / REFERENCE_HEIGHT;

    const shadow = createUiNode('ModalShadow', panelWidth + 14, panelHeight + 16);
    drawRounded(shadow, panelWidth + 14, panelHeight + 16, MODAL_SHADOW, radius + 2);
    shadow.setPosition(0, -9);
    overlay.addChild(shadow);

    const panel = createUiNode('ModalPanel', panelWidth, panelHeight);
    // 面板自身 Graphics 仅作为 GRAPHICS_STENCIL 模板形状。注意：Mask 的模板层
    // （ENTER_LEVEL）在渲染时模板测试恒失败、只写模板缓冲，颜色不会输出，
    // 因此面板背景必须由子节点绘制，否则弹窗会变成透明。
    drawRounded(panel, panelWidth, panelHeight, Color.WHITE, radius);
    const mask = panel.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_STENCIL;
    overlay.addChild(panel);

    // 实际背景：作为第一个子节点绘制，被模板裁剪进圆角范围，同时可见。
    const background = createUiNode('ModalBackground', panelWidth, panelHeight);
    drawRounded(background, panelWidth, panelHeight, MODAL_FILL, radius,
      { color: MODAL_EDGE, width: 4 });
    panel.addChild(background);

    const closeSize = options.closeSize ?? Math.round(panelWidth * 0.112);
    if (options.showClose !== false) {
      const closeButton = createIconButton('ModalClose',
        this.art.frame(GAME_CONFIG.art.close), '×', closeSize, close);
      closeButton.setPosition(
        panelWidth / 2 - 52 * closeSize / 76,
        panelHeight / 2 - 52 * closeSize / 76,
      );
      panel.addChild(closeButton);
    }

    if (options.title) {
      this.addTitle(panel, panelWidth, options.title, options.titleSize ?? 52,
        options.titleColor ?? MODAL_TITLE, sy);
      if (options.topDecoration !== false) addTopDecoration(panel, sx, sy);
      if (options.titleDots !== false) addTitleDots(panel, sx, sy);
    }
    if (options.bottomDecoration !== false) addBottomDecoration(panel, panelWidth, panelHeight);

    panel.setScale(options.scaleFrom ?? 0.86, options.scaleFrom ?? 0.86, 1);
    tween(panel).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();

    return { overlay, panel, close };
  }

  /** 标准确认弹窗：标题 + 正文 + 辅助按钮（可选）+ 取消/确认。 */
  public showDialog(parent: Node, titleText: string, bodyText: string, cancelText: string,
    confirmText: string, actions: DialogActions): ModalHandle {
    const panelHeight = actions.auxiliary ? 580 : 430;
    const handle = this.open(parent, {
      width: 590,
      height: panelHeight,
      title: titleText,
      onClose: () => actions.onCancel?.(),
    });
    const panel = handle.panel;
    const sy = panelHeight / REFERENCE_HEIGHT;
    const titleY = 232 * sy;

    const body = createLabel(bodyText, 28, COLORS.ink, 490, 130);
    body.node.setPosition(0, titleY - 95);
    panel.addChild(body.node);

    if (actions.auxiliary) {
      const auxiliary = createButton(actions.auxiliary.text, 500, 78, COLORS.mustard,
        () => actions.auxiliary?.onTap(), 30, this.art.frame(GAME_CONFIG.art.share));
      auxiliary.setPosition(0, -95);
      panel.addChild(auxiliary);
    }

    const cancel = createPillButton(cancelText, handle.close, {
      width: 230,
      height: 78,
      color: actions.cancelTone === 'primary' ? COLORS.coral : COLORS.teal,
      fontSize: 28,
    });
    cancel.setPosition(-135, actions.auxiliary ? -170 : -95);
    panel.addChild(cancel);

    const confirm = createPillButton(confirmText, () => {
      handle.overlay.destroy();
      actions.onConfirm();
    }, {
      width: 230,
      height: 78,
      color: actions.confirmTone === 'secondary' ? COLORS.teal : COLORS.coral,
      fontSize: 28,
    });
    confirm.setPosition(135, actions.auxiliary ? -170 : -95);
    panel.addChild(confirm);
    return handle;
  }

  /** 顶部/底部轻提示（非阻塞样式）。 */
  public showNotice(parent: Node | null, text: string,
    options: { readonly anchor?: 'top' | 'bottom'; readonly offset?: number } = {}): void {
    if (!parent) return;
    const { height } = this.getSize();
    const notice = createUiNode('ModalNotice', 500, 78);
    drawRounded(notice, 500, 78, COLORS.ink, 24);
    const label = createLabel(text, 24, COLORS.white, 450, 60);
    notice.addChild(label.node);
    const anchor = options.anchor ?? 'bottom';
    const offset = options.offset ?? (anchor === 'top' ? 178 : 132);
    notice.setPosition(0, anchor === 'top' ? height / 2 - offset : -height / 2 + offset);
    const opacity = notice.addComponent(UIOpacity);
    opacity.opacity = 0;
    parent.addChild(notice);
    tween(opacity)
      .to(0.12, { opacity: 255 })
      .delay(1.8)
      .to(0.2, { opacity: 0 })
      .call(() => notice.destroy())
      .start();
  }

  private addTitle(panel: Node, panelWidth: number, text: string, fontSize: number,
    color: Color, sy: number): void {
    const title = createLabel(text, fontSize, color, panelWidth - 80, fontSize * 1.5, 'display');
    title.node.setPosition(0, 232 * sy);
    panel.addChild(title.node);
  }
}
