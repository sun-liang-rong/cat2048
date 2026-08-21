/**
 * 文字排版工具：标签创建与字体样式应用。
 */
import { Color, Font, Label, Vec2 } from 'cc';
import { selectLabelFont } from '../styles/fontPolicy';
import { createUiNode } from './graphics';
import { COLORS } from './colors';

export type LabelStyle = 'body' | 'display';
export type LabelFontPreference = 'auto' | 'display' | 'number';

const BODY_FONT_FAMILY = 'Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif';
const DISPLAY_FONT_FAMILY = 'ZCOOL KuaiLe, Microsoft YaHei, PingFang SC, sans-serif';
const DISPLAY_DARK_OUTLINE = new Color(74, 45, 39, 255);
const DISPLAY_LIGHT_OUTLINE = new Color(255, 240, 202, 255);
const DISPLAY_DARK_SHADOW = new Color(72, 36, 32, 125);
const DISPLAY_LIGHT_SHADOW = new Color(150, 92, 54, 95);

let displayFont: Font | null = null;
let numberFont: Font | null = null;

/** 注入运行时加载的自定义字体（display 主字体、number 数字字体）。 */
export function setRuntimeFonts(display: Font | null, numbers: Font | null): void {
  displayFont = display;
  numberFont = numbers;
}

/** 创建带样式的文本标签。 */
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

/** 更新已有标签的文本与样式。 */
export function setLabelText(label: Label, text: string, style: LabelStyle = 'body',
  fontSize = label.fontSize, fontPreference: LabelFontPreference = 'auto'): void {
  label.string = text;
  label.fontSize = fontSize;
  applyLabelStyle(label, fontSize, label.color, style, fontPreference);
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
