/**
 * 全局 UI 调色板与语义色板。
 *
 * 视图层统一从这里取色；组件专属的插画色板（棋块配色、勋章、弹窗装饰）
 * 保留在各自文件中，不属于全局主题。
 */
import { Color } from 'cc';

export const COLORS = {
  // ---- 基础色 ----
  ink: new Color(60, 48, 44, 255),
  ivory: new Color(255, 247, 225, 255),
  cream: new Color(248, 225, 181, 255),
  coral: new Color(239, 100, 83, 255),
  teal: new Color(39, 166, 151, 255),
  mustard: new Color(245, 180, 54, 255),
  overlay: new Color(39, 29, 35, 190),
  cell: new Color(255, 244, 213, 190),
  white: new Color(255, 255, 255, 255),

  // ---- 文字 ----
  /** 页面大标题 */
  title: new Color(91, 49, 31, 255),
  /** 弹窗标题、卡片名等次级标题 */
  heading: new Color(91, 53, 39, 255),
  /** 正文主文字 */
  textBody: new Color(103, 67, 48, 255),
  /** 次要说明文字 */
  textMuted: new Color(148, 118, 106, 255),
  /** 禁用态文字 */
  textDisabled: new Color(126, 115, 106, 255),
  /** 未解锁态文字 */
  textLocked: new Color(244, 228, 196, 255),
  /** 深色底上的浅色文字 */
  textLight: new Color(255, 248, 232, 255),

  // ---- 描边（棕色系，按强度分档）----
  /** 强描边：卡片外框、进度条边框 */
  edgeBrown: new Color(105, 61, 40, 255),
  /** 中等描边：导航栏、dock 外框 */
  frameBrown: new Color(139, 84, 50, 255),
  /** 柔和描边：面板、道具按钮的内向描边 */
  softBrown: new Color(139, 91, 59, 255),

  // ---- 表面 ----
  /** 纸质卡片表面（回退自绘） */
  surfacePaper: new Color(255, 248, 224, 250),
  /** 面板/HUD 底色 */
  surfaceWarm: new Color(255, 249, 232, 240),
  /** 弹窗内行/卡片底色 */
  surfaceCard: new Color(255, 252, 244, 255),
  /** 胶囊、小控件底色 */
  surfaceSoft: new Color(255, 248, 228, 240),
  /** 页面背景回退色（无背景图时） */
  pageCream: new Color(255, 246, 220, 255),
  /** 进度条轨道沙色 */
  trackSand: new Color(235, 216, 190, 255),
  /** 排行榜骨架屏占位色 */
  skeleton: new Color(226, 214, 194, 255),

  // ---- 状态（禁用按钮底色）----
  disabledSurface: new Color(156, 148, 136, 210),
} as const;

/** 派生同色不同透明度的颜色（用于阴影、高光等半透明层）。 */
export function withAlpha(color: Color, alpha: number): Color {
  const derived = color.clone();
  derived.a = alpha;
  return derived;
}
