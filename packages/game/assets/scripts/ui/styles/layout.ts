export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MiniGameSystemInfoLike {
  windowWidth?: number;
}

export interface MenuButtonRectLike {
  bottom?: number;
}

export interface GameLayout {
  hudCenterFromTop: number;
  evolutionPanelCenterFromTop: number;
  evolutionPanelHeight: number;
  statsBarCenterFromTop: number;
  statsBarHeight: number;
  boardTop: number;
  boardScale: number;
  itemBarCenterFromTop: number;
}

export interface SpriteCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteCropTransform {
  width: number;
  height: number;
  x: number;
  y: number;
}

/** Scales and offsets a source image so the requested crop fills a square masked viewport. */
export function spriteCropTransform(viewSize: number, sourceWidth: number, sourceHeight: number,
  crop: SpriteCropRect): SpriteCropTransform {
  const scale = viewSize / Math.max(crop.width, crop.height);
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    x: (sourceWidth / 2 - crop.x - crop.width / 2) * scale,
    y: (crop.y + crop.height / 2 - sourceHeight / 2) * scale,
  };
}

/** Cocos already returns the safe-area rectangle in design-resolution units. */
export function safeInsetsFromRect(uiHeight: number, rect?: RectLike | null): { top: number; bottom: number } {
  if (!rect || ![rect.y, rect.height].every(Number.isFinite)) return { top: 24, bottom: 20 };
  const bottom = Math.max(0, Math.min(uiHeight, rect.y));
  const safeTop = Math.max(0, Math.min(uiHeight, rect.y + rect.height));
  return {
    top: Math.max(24, uiHeight - safeTop),
    bottom: Math.max(20, bottom),
  };
}

/**
 * The WeChat menu capsule is lower than the OS safe area. Convert its CSS
 * coordinates into the same fixed-width design units used by the Canvas.
 */
export function capsuleBottomInset(uiWidth: number, system: MiniGameSystemInfoLike | undefined,
  menu: MenuButtonRectLike | undefined): number {
  const windowWidth = system?.windowWidth;
  const bottom = menu?.bottom;
  if (!Number.isFinite(windowWidth) || !Number.isFinite(bottom) || (windowWidth ?? 0) <= 0) return 0;
  return (bottom as number) * uiWidth / (windowWidth as number) + 16;
}

/** Returns evenly spaced x positions centered around the home action dock. */
export function homeActionDockPositions(count: number, spacing = 116): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const center = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => (index - center) * spacing);
}

const GAME_EVOLUTION_PANEL_HEIGHT = 204;
const GAME_STATS_BAR_HEIGHT = 62;

/** Keeps the HUD, one-hand board, and item bar clear of both safe areas. */
export function gameLayout(uiWidth: number, uiHeight: number, topInset: number, bottomInset: number,
  boardPixels: number): GameLayout {
  const hudCenterFromTop = topInset + 70;
  const hudBottom = hudCenterFromTop + 46;
  const itemBarHeight = 96;
  const itemBarGap = 18;
  const bottomComfortInset = 24;
  // 步数 / 合成 / 空位（stats bar）是玩家最关心的进度信息，无论机型大
  // 小都常驻显示；紧凑屏幕由进化面板负责收缩兜底，而不是把 stats bar
  // 整条隐藏。
  const statsBarHeight = GAME_STATS_BAR_HEIGHT;
  const hudToStatsGap = 14;
  const evolutionToStatsGap = 18;
  const statsToBoardGap = 18;
  // 任何机型都要保证 stats bar 顶部不撞 HUD、底部不撞棋盘。
  const statsRequiredBoardTop = hudBottom + hudToStatsGap + statsBarHeight + statsToBoardGap;
  const minimumBoardTop = Math.max(hudCenterFromTop + 46 + 58, statsRequiredBoardTop);
  const availableBoardHeight = Math.max(0,
    uiHeight - bottomInset - bottomComfortInset - itemBarHeight - itemBarGap - minimumBoardTop);
  const widthScale = Math.max(0, (uiWidth - 32) / boardPixels);
  const boardScale = Math.max(0, Math.min(1, widthScale, availableBoardHeight / boardPixels));
  const displaySize = boardPixels * boardScale;
  const maximumBoardTop = uiHeight - bottomInset - bottomComfortInset
    - itemBarHeight - itemBarGap - displaySize;
  // 优先保留完整布局（进化面板 + stats bar + 棋盘），空间不足时让 board
  // 贴向最大允许位置，从而保证 stats bar 的位置稳定可见。
  const fullLayoutBoardTop = hudBottom + hudToStatsGap
    + GAME_EVOLUTION_PANEL_HEIGHT + evolutionToStatsGap + statsBarHeight + statsToBoardGap;
  const preferredBoardTop = fullLayoutBoardTop <= maximumBoardTop
    ? fullLayoutBoardTop
    : maximumBoardTop;
  const boardTop = Math.max(minimumBoardTop, Math.min(maximumBoardTop, preferredBoardTop));
  // stats bar 固定贴 board 上方 statsToBoardGap，腾出的中间空间给进化
  // 面板；面板够大就显示，否则隐藏并把 stats bar 自然上移。
  const statsBarTopFromTop = boardTop - statsToBoardGap - statsBarHeight;
  const evolutionRegionTop = hudBottom + hudToStatsGap;
  const evolutionRegionBottom = statsBarTopFromTop - evolutionToStatsGap;
  const evolutionAvailable = Math.max(0, evolutionRegionBottom - evolutionRegionTop);
  const EVOLUTION_MIN_HEIGHT = 80;
  const evolutionPanelHeight = evolutionAvailable >= EVOLUTION_MIN_HEIGHT
    ? Math.min(GAME_EVOLUTION_PANEL_HEIGHT, evolutionAvailable)
    : 0;
  const statsBarCenterFromTop = statsBarTopFromTop + statsBarHeight / 2;
  return {
    hudCenterFromTop,
    evolutionPanelCenterFromTop: evolutionRegionTop + evolutionPanelHeight / 2,
    evolutionPanelHeight,
    statsBarCenterFromTop,
    statsBarHeight,
    boardTop,
    boardScale,
    itemBarCenterFromTop: boardTop + displaySize + itemBarGap + itemBarHeight / 2,
  };
}
