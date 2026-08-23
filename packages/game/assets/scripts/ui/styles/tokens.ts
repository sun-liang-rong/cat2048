/**
 * 设计 token：字号阶梯、圆角阶梯与跨屏幕共享的尺寸常量。
 *
 * 视图布局常量（间距、元素宽高）仍留在各视图文件内；这里只放
 * 多个视图共用或需要保持一致性的值。
 */

/** 字号阶梯：新 UI 从这些档位中选取，不再发明新字号。 */
export const FONT_SIZE = {
  /** 首页大标题 */
  display: 65,
  /** 页面标题（图鉴/商店/排行榜） */
  title: 50,
  /** 主按钮、重点文案 */
  heading: 34,
  /** 区块小标题 */
  subtitle: 25,
  /** 正文与按钮默认字号 */
  body: 22,
  /** 次要说明 */
  caption: 18,
} as const;

/** 圆角阶梯。 */
export const RADIUS = {
  small: 16,
  medium: 22,
  card: 28,
  /** 胶囊形（高度一半） */
  pill: Number.MAX_SAFE_INTEGER,
} as const;

/**
 * 底部导航 dock 的统一高度。
 * HomeView 计算内容区域与 ModernNavDock 绘制均使用此值。
 */
export const NAV_DOCK_HEIGHT = 168;
