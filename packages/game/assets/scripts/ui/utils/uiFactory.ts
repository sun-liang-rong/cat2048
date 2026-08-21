import {
  Color,
  Font,
  Graphics,
  Label,
  Layers,
  Mask,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';
import { spriteCropTransform } from '../styles/layout';
import type { SpriteCropRect } from '../styles/layout';
import { selectLabelFont } from '../styles/fontPolicy';

export const COLORS = {
  ink: new Color(60, 48, 44, 255),
  ivory: new Color(255, 247, 225, 255),
  cream: new Color(248, 225, 181, 255),
  coral: new Color(239, 100, 83, 255),
  teal: new Color(39, 166, 151, 255),
  mustard: new Color(245, 180, 54, 255),
  overlay: new Color(39, 29, 35, 190),
  cell: new Color(255, 244, 213, 190),
  white: new Color(255, 255, 255, 255),
} as const;

export type LabelStyle = 'body' | 'display';
export type LabelFontPreference = 'auto' | 'display' | 'number';

const BODY_FONT_FAMILY = 'Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif';
const DISPLAY_FONT_FAMILY = 'ZCOOL KuaiLe, Microsoft YaHei, PingFang SC, sans-serif';
const DISPLAY_DARK_OUTLINE = new Color(74, 45, 39, 255);
const DISPLAY_LIGHT_OUTLINE = new Color(255, 240, 202, 255);
const DISPLAY_DARK_SHADOW = new Color(72, 36, 32, 125);
const DISPLAY_LIGHT_SHADOW = new Color(150, 92, 54, 95);
const MIN_TOUCH_TARGET = 88;

let displayFont: Font | null = null;
let numberFont: Font | null = null;

export function setRuntimeFonts(display: Font | null, numbers: Font | null): void {
  displayFont = display;
  numberFont = numbers;
}

export function createUiNode(name: string, width = 0, height = 0): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  node.addComponent(UITransform).setContentSize(width, height);
  return node;
}

export function drawRounded(node: Node, width: number, height: number, color: Color, radius = 24,
  stroke?: { color: Color; width: number }): Graphics {
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.clear();
  graphics.fillColor = color;
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  if (stroke) {
    graphics.strokeColor = stroke.color;
    graphics.lineWidth = stroke.width;
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.stroke();
  }
  return graphics;
}

function isLightColor(color: Color): boolean {
  return color.r * 0.299 + color.g * 0.587 + color.b * 0.114 > 170;
}

function applyLabelStyle(label: Label, fontSize: number, color: Color, style: LabelStyle,
  fontPreference: LabelFontPreference = 'auto'): void {
  label.enableOutline = false;
  label.enableShadow = false;
  label.isBold = false;

  if (style === 'display') {
    label.lineHeight = Math.round(fontSize * 1.14);
    const selectedFont = fontPreference === 'auto' ? selectLabelFont(style, label.string) : fontPreference;
    const customFont = selectedFont === 'number' ? numberFont : selectedFont === 'display' ? displayFont : null;
    if (customFont) {
      label.useSystemFont = false;
      label.font = customFont;
    } else {
      label.useSystemFont = true;
      label.font = null;
      label.fontFamily = selectedFont === 'body' ? BODY_FONT_FAMILY : DISPLAY_FONT_FAMILY;
    }
    if (selectedFont === 'number' && numberFont) return;
    label.isBold = true;

    const lightText = isLightColor(color);
    label.enableOutline = true;
    label.outlineColor = lightText ? DISPLAY_DARK_OUTLINE : DISPLAY_LIGHT_OUTLINE;
    label.outlineWidth = Math.max(1, Math.min(5, Math.round(fontSize * 0.06)));
    label.enableShadow = true;
    label.shadowColor = lightText ? DISPLAY_DARK_SHADOW : DISPLAY_LIGHT_SHADOW;
    label.shadowOffset = new Vec2(0, -Math.max(1, Math.round(fontSize * 0.05)));
    label.shadowBlur = 0;
    return;
  }

  label.useSystemFont = true;
  label.font = null;
  label.fontFamily = BODY_FONT_FAMILY;
  label.lineHeight = Math.round(fontSize * 1.25);
}

export function createLabel(text: string, fontSize: number, color = COLORS.ink,
  width = 500, height = fontSize * 1.5, style: LabelStyle = 'body',
  fontPreference: LabelFontPreference = 'auto'): Label {
  const node = createUiNode(`Label:${text}`, width, height);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.color = color;
  applyLabelStyle(label, fontSize, color, style, fontPreference);
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = Label.Overflow.SHRINK;
  return label;
}

export function setLabelText(label: Label, text: string, style: LabelStyle = 'body',
  fontSize = label.fontSize, fontPreference: LabelFontPreference = 'auto'): void {
  label.string = text;
  label.fontSize = fontSize;
  applyLabelStyle(label, fontSize, label.color, style, fontPreference);
}

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

export function createButton(text: string, width: number, height: number, color: Color,
  onTap: () => void, fontSize = 34, icon?: SpriteFrame): Node {
  const node = createUiNode(`Button:${text}`, width, height);
  renderButtonBackground(node, width, height, color);
  if (icon) {
    const iconNode = createSpriteNode(`Button:${text}:Icon`, icon, height * 0.56, height * 0.56);
    iconNode.setPosition(-width / 2 + height * 0.5, 0);
    node.addChild(iconNode);
  }
  const label = createLabel(text, fontSize, COLORS.white, icon ? width - height - 24 : width - 30, height - 12, 'display');
  if (icon) label.node.setPosition(height * 0.36, 0);
  node.addChild(label.node);
  node.on(Node.EventType.TOUCH_START, () => tween(node).to(0.05, { scale: new Vec3(0.96, 0.96, 1) }).start());
  node.on(Node.EventType.TOUCH_CANCEL, () => tween(node).to(0.08, { scale: Vec3.ONE }).start());
  node.on(Node.EventType.TOUCH_END, () => {
    tween(node).to(0.08, { scale: Vec3.ONE }).call(onTap).start();
  });
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
  node.on(Node.EventType.TOUCH_START, () => tween(node).to(0.05, { scale: new Vec3(0.96, 0.96, 1) }).start());
  node.on(Node.EventType.TOUCH_CANCEL, () => tween(node).to(0.08, { scale: Vec3.ONE }).start());
  node.on(Node.EventType.TOUCH_END, () => {
    current = !current;
    render(true);
    tween(node).to(0.08, { scale: Vec3.ONE }).call(() => onChange(current)).start();
  });
  addExpandedTouchTarget(node, 110, 58);
  return node;
}

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
  node.on(Node.EventType.TOUCH_START, () => tween(node).to(0.05, { scale: new Vec3(0.9, 0.9, 1) }).start());
  node.on(Node.EventType.TOUCH_CANCEL, () => tween(node).to(0.08, { scale: Vec3.ONE }).start());
  node.on(Node.EventType.TOUCH_END, () => {
    tween(node).to(0.08, { scale: Vec3.ONE }).call(onTap).start();
  });
  return node;
}
