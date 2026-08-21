/**
 * 首页UI颜色配置
 * 统一管理所有颜色值，便于主题切换和维护
 */
import { Color } from 'cc';

export const HOME_COLORS = {
  // 主题色
  primary: new Color(139, 90, 60, 255),        // 深褐色 - 主文字
  secondary: new Color(255, 184, 77, 255),     // 橙黄色 - 标题强调
  
  // 背景色
  bgBase: new Color(255, 247, 225, 255),       // 奶白 - 页面底色
  bgWood: new Color(252, 237, 203, 255),       // 木质色 - 导航栏
  bgWoodDark: new Color(252, 229, 184, 255),   // 木质色（深）
  bgWhite: new Color(255, 250, 240, 255),      // 象牙白 - 钱包背景
  bgButton: new Color(255, 250, 238, 255),     // 按钮背景
  
  // 边框色
  border: new Color(169, 123, 80, 220),        // 主边框
  borderLight: new Color(209, 163, 110, 150),  // 浅边框
  borderDark: new Color(210, 170, 130, 200),   // 钱包边框
  borderNav: new Color(139, 84, 50, 200),      // 导航边框
  
  // 强调色
  accent: new Color(255, 107, 74, 255),        // 珊瑚红 - 徽章
  accentGlow: new Color(255, 124, 82, 60),     // 珊瑚红发光
  
  // 文字色
  textPrimary: new Color(103, 67, 48, 255),    // 主文字
  textLight: new Color(255, 248, 232, 255),    // 浅色文字
  textShadow: new Color(139, 90, 60, 60),      // 文字阴影
  
  // 阴影色系
  shadowLight: new Color(139, 84, 50, 40),     // 浅阴影 - 微妙深度
  shadowMedium: new Color(139, 84, 50, 80),    // 中阴影 - 悬浮效果
  shadowDark: new Color(139, 84, 50, 120),     // 深阴影 - 强烈对比
  shadowSubtle: new Color(139, 84, 50, 30),    // 极浅阴影 - 内阴影
  
  // 高光色系
  highlightWhite: new Color(255, 255, 255, 100), // 白色高光
  highlightWarm: new Color(255, 250, 235, 100),  // 温暖高光
  highlightYellow: new Color(255, 248, 232, 255), // 金色高光
  
  // 发光效果
  glowWarm: new Color(255, 200, 140, 50),      // 温暖发光 - 开始按钮
  glowWarmBright: new Color(255, 220, 180, 30), // 温暖发光（亮）
  glowShowcase: new Color(255, 240, 200, 60),  // 展示区发光
  glowNav: new Color(255, 243, 210, 80),       // 导航按钮发光
  
  // 特殊效果
  badgeRed: new Color(255, 107, 74, 255),      // 红点徽章
  badgeRedBorder: new Color(255, 248, 232, 255), // 徽章边框
} as const;

/**
 * UI尺寸常量
 */
export const HOME_SIZES = {
  // 主要元素
  showcaseSize: 560,        // 猫咪展示区
  playButtonSize: 340,      // 开始按钮
  sideButtonSize: 130,      // 侧边按钮
  walletHeight: 56,         // 钱包高度
  walletWidth: 240,         // 钱包宽度
  
  // 间距
  titleTop: 50,             // 标题距顶部
  walletTop: 130,           // 钱包距顶部
  showcaseTop: 200,         // 展示区距顶部
  playDockGap: 80,          // 按钮距底栏
  
  // 导航栏
  dockHeight: 168,          // 导航栏高度
  
  // 圆角
  radiusLarge: 28,          // 大圆角
  radiusMedium: 16,         // 中圆角
  radiusSmall: 6,           // 小圆角
  
  // 边框
  borderThin: 2,
  borderMedium: 3,
  borderThick: 4,
} as const;

/**
 * 动画参数
 */
export const HOME_ANIMATIONS = {
  // 浮动动画
  floatDistance: 4,         // 浮动距离（px）
  floatDuration: 2.2,       // 浮动周期（秒）
  
  // 脉冲动画
  pulseScale: 1.08,         // 脉冲缩放比例
  pulseDuration: 0.9,       // 脉冲周期（秒）
  
  // 呼吸动画
  breatheScale: 1.02,       // 呼吸缩放比例
  breatheDuration: 2.0,     // 呼吸周期（秒）
  
  // 旋转动画
  rotateDuration: 3.0,      // 旋转周期（秒）
  
  // 点击反馈
  tapScale: 0.92,           // 点击缩小比例
  tapDuration: 0.08,        // 点击动画时长
  
  // 徽章脉冲
  badgePulseScale: 1.15,    // 徽章脉冲比例
  badgePulseDuration: 0.6,  // 徽章脉冲周期
  
  // 光晕扩散
  haloMaxScale: 1.1,        // 光晕最大缩放
  haloDuration: 1.5,        // 光晕扩散时长
} as const;
