/**
 * UI 控件工厂（模块入口）。
 *
 * 公开 API 统一从这里 re-export，保持导入面稳定：
 * - 调色板：./colors
 * - 基础图形：./graphics
 * - 文字排版：./typography
 */
import {
  Color,
  Graphics,
  Mask,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UITransform,
  Vec3,
} from 'cc';
import { spriteCropTransform } from '../styles/layout';
import type { SpriteCropRect } from '../styles/layout';
import { COLORS } from './colors';
import { createUiNode, drawRounded } from './graphics';
import { createLabel } from './typography';

export * from './colors';
export * from './graphics';
export * from './typography';

const MIN_TOUCH_TARGET = 88;
/** 统一按下反馈的缩放比例。 */
const TAP_SCALE = 0.94;

/**
 * 统一的按压反馈：按下轻微缩小，松开回弹后触发回调。
 * 所有可点击控件都应使用本函数，保证全应用手感一致。
 */
export function bindTapFeedback(node: Node, onTap: () => void, scale = TAP_SCALE): void {
  node.on(Node.EventType.TOUCH_START, () =>
    tween(node).to(0.05, { scale: new Vec3(scale, scale, 1) }).start());
  node.on(Node.EventType.TOUCH_CANCEL, () =>
    tween(node).to(0.08, { scale: Vec3.ONE }).start());
  node.on(Node.EventType.TOUCH_END, () =>
    tween(node).to(0.08, { scale: Vec3.ONE }).call(onTap).start());
}

/** 创建精灵节点（设置自定义尺寸）。 */
export function createSpriteNode(name: string, frame: SpriteFrame, width: number, height: number): Node {
  const node = createUiNode(name, width, height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = frame;
  // Assigning a frame can restore its imported pixel dimensions. Reapply the
  // requested UI size so large source sprites do not overflow their layout.
  node.getComponent(UITransform)?.setContentSize(width, height);
  return node;
}

/** 重绘按钮背景（圆角矩形 + 深色描边）。 */
export function renderButtonBackground(node: Node, width: number, height: number, color: Color): void {
  node.getChildByName('ButtonBackground')?.destroy();
  node.getComponent(Graphics)?.clear();
  drawRounded(node, width, height, color, 24, { color: COLORS.ink, width: 5 });
}

/** Keeps compact controls visually small while giving touch input a stable, usable target. */
function addExpandedTouchTarget(node: Node, width: number, height: number): void {
  const touchWidth = Math.max(width, MIN_TOUCH_TARGET);
  const touchHeight = Math.max(height, MIN_TOUCH_TARGET);
  if (touchWidth === width && touchHeight === height) return;
  const target = createUiNode(`${node.name}:TouchTarget`, touchWidth, touchHeight);
  // The empty listeners make this transparent node a hit-test target; events still bubble to the control.
  target.on(Node.EventType.TOUCH_START, () => undefined);
  target.on(Node.EventType.TOUCH_CANCEL, () => undefined);
  target.on(Node.EventType.TOUCH_END, () => undefined);
  node.addChild(target);
  target.setSiblingIndex(0);
}

/** 创建圆角按钮（可带左侧图标）。 */
export function createButton(text: string, width: number, height: number, color: Color,
  onTap: () => void, fontSize = 34, icon?: SpriteFrame): Node {
  const node = createUiNode(`Button:${text}`, width, height);
  renderButtonBackground(node, width, height, color);
  if (icon) {
    const iconNode = createSpriteNode(`Button:${text}:Icon`, icon, height * 0.56, height * 0.56);
    iconNode.setPosition(-width / 2 + height * 0.5, 0);
    node.addChild(iconNode);
  }
  const labelWidth = icon ? width - height - 12 : width - 30;
  const labelX = icon ? height * 0.3 : 0;
  const label = createLabel(text, fontSize, COLORS.white, labelWidth, height - 12, 'display');
  label.node.setPosition(labelX, 0);
  node.addChild(label.node);
  bindTapFeedback(node, onTap);
  addExpandedTouchTarget(node, width, height);
  return node;
}

export interface PillButtonOptions {
  readonly width?: number;
  readonly height?: number;
  readonly color?: Color;
  readonly fontSize?: number;
  readonly icon?: SpriteFrame;
}

/** Creates the compact capsule buttons used for actions such as continue/home. */
export function createPillButton(text: string, onTap: () => void,
  options: PillButtonOptions = {}): Node {
  return createButton(
    text,
    options.width ?? 230,
    options.height ?? 78,
    options.color ?? COLORS.coral,
    onTap,
    options.fontSize ?? 27,
    options.icon,
  );
}

export interface ToggleOptions {
  readonly onColor?: Color;
  readonly offColor?: Color;
  readonly knobColor?: Color;
  readonly pawColor?: Color;
}

/** 创建开关控件（带猫爪旋钮）。 */
export function createToggle(name: string, enabled: boolean, onChange: (enabled: boolean) => void,
  options: ToggleOptions = {}): Node {
  const node = createUiNode(`${name}:${enabled ? 'On' : 'Off'}`, 110, 58);
  const knob = createUiNode(`${name}:Knob`, 46, 46);
  const paw = createUiNode(`${name}:Paw`, 34, 34);
  const pawGraphics = paw.addComponent(Graphics);
  let current = enabled;
  const onColor = options.onColor ?? COLORS.teal;
  const offColor = options.offColor ?? COLORS.cream;
  const knobColor = options.knobColor ?? COLORS.ivory;
  const pawColor = options.pawColor ?? new Color(212, 192, 165, 125);
  node.addChild(knob);
  knob.addChild(paw);

  const render = (animate: boolean): void => {
    node.name = `${name}:${current ? 'On' : 'Off'}`;
    drawRounded(node, 110, 58, current ? onColor : offColor, 29,
      { color: COLORS.ink, width: 4 });
    drawRounded(knob, 46, 46, knobColor, 23, { color: COLORS.ink, width: 3 });
    pawGraphics.clear();
    pawGraphics.fillColor = pawColor;
    pawGraphics.ellipse(0, -4, 7, 5);
    pawGraphics.fill();
    for (const toe of [[-8, 5, 3], [-3, 9, 3], [3, 9, 3], [8, 5, 3]] as const) {
      pawGraphics.circle(toe[0], toe[1], toe[2]);
      pawGraphics.fill();
    }
    const position = new Vec3(current ? 25 : -25, 0, 0);
    Tween.stopAllByTarget(knob);
    if (animate) tween(knob).to(0.12, { position }, { easing: 'quadOut' }).start();
    else knob.setPosition(position);
  };

  render(false);
  bindTapFeedback(node, () => {
    current = !current;
    render(true);
    onChange(current);
  });
  addExpandedTouchTarget(node, 110, 58);
  return node;
}

/** 创建圆形图标按钮（可带图片或文字回退）。 */
export function createIconButton(name: string, frame: SpriteFrame | undefined, fallback: string,
  size: number, onTap: () => void, crop?: SpriteCropRect): Node {
  const node = createUiNode(name, Math.max(size, MIN_TOUCH_TARGET), Math.max(size, MIN_TOUCH_TARGET));
  const visual = createUiNode(`${name}:Visual`, size, size);
  node.addChild(visual);
  if (frame) {
    let iconWidth = size;
    let iconHeight = size;
    let iconX = 0;
    let iconY = 0;
    if (crop) {
      visual.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
      const sourceSize = frame.originalSize;
      const transform = spriteCropTransform(size, sourceSize.width, sourceSize.height, crop);
      iconWidth = transform.width;
      iconHeight = transform.height;
      iconX = transform.x;
      iconY = transform.y;
    }
    const icon = createSpriteNode(`${name}:Icon`, frame, iconWidth, iconHeight);
    icon.setPosition(iconX, iconY);
    visual.addChild(icon);
  } else {
    drawRounded(visual, size, size, new Color(255, 248, 226, 235), size / 2,
      { color: COLORS.ink, width: 4 });
    const label = createLabel(fallback, size * 0.5, COLORS.ink, size * 0.8, size * 0.8);
    visual.addChild(label.node);
  }
  bindTapFeedback(node, onTap, 0.9);
  return node;
}
