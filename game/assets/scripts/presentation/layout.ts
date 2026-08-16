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

const HOME_CONTENT_TOP = 64;
const HOME_CONTENT_BOTTOM = 815;
const HOME_DOCK_TOP_FROM_BOTTOM = 138;
const HOME_DOCK_GAP = 24;

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

/** Centers the home content in the free region above the bottom action dock. */
export function homeContentShift(uiHeight: number, topInset: number, bottomInset: number): number {
  const dockTop = uiHeight - bottomInset - HOME_DOCK_TOP_FROM_BOTTOM;
  const availableHeight = Math.max(0, dockTop - topInset);
  const centeredShift = (availableHeight - (HOME_CONTENT_TOP + HOME_CONTENT_BOTTOM)) / 2;
  const maxShift = Math.max(0, availableHeight - HOME_CONTENT_BOTTOM - HOME_DOCK_GAP);
  return Math.max(0, Math.min(maxShift, centeredShift));
}

/** Returns evenly spaced x positions centered around the home action dock. */
export function homeActionDockPositions(count: number, spacing = 116): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const center = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => (index - center) * spacing);
}

/** Keeps the HUD, one-hand board, and item bar clear of both safe areas. */
export function gameLayout(uiWidth: number, uiHeight: number, topInset: number, bottomInset: number,
  boardPixels: number): GameLayout {
  const hudCenterFromTop = topInset + 70;
  const minimumBoardTop = hudCenterFromTop + 46 + 58;
  const itemBarHeight = 96;
  const itemBarGap = 18;
  const bottomComfortInset = 24;
  const availableBoardHeight = Math.max(0,
    uiHeight - bottomInset - bottomComfortInset - itemBarHeight - itemBarGap - minimumBoardTop);
  const widthScale = Math.max(0, (uiWidth - 32) / boardPixels);
  const boardScale = Math.max(0, Math.min(1, widthScale, availableBoardHeight / boardPixels));
  const displaySize = boardPixels * boardScale;
  const maximumBoardTop = uiHeight - bottomInset - bottomComfortInset
    - itemBarHeight - itemBarGap - displaySize;
  const preferredBoardTop = minimumBoardTop + Math.max(0, maximumBoardTop - minimumBoardTop) * 0.82;
  const boardTop = Math.max(minimumBoardTop, Math.min(maximumBoardTop, preferredBoardTop));
  const hudBottom = hudCenterFromTop + 46;
  const panelSpace = boardTop - hudBottom - 28;
  const evolutionPanelHeight = panelSpace >= 176 ? Math.min(236, panelSpace) : 0;
  return {
    hudCenterFromTop,
    evolutionPanelCenterFromTop: hudBottom + 14 + evolutionPanelHeight / 2,
    evolutionPanelHeight,
    boardTop,
    boardScale,
    itemBarCenterFromTop: boardTop + displaySize + itemBarGap + itemBarHeight / 2,
  };
}
