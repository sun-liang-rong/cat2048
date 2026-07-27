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
  boardTop: number;
  boardScale: number;
  instructionCenterFromTop: number;
}

const HOME_CONTENT_TOP = 64;
const HOME_CONTENT_BOTTOM = 815;
const HOME_DOCK_TOP_FROM_BOTTOM = 138;
const HOME_DOCK_GAP = 24;

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

/** Keeps the HUD clear of the capsule and the complete board above the bottom safe area. */
export function gameLayout(uiWidth: number, uiHeight: number, topInset: number, bottomInset: number,
  boardPixels: number): GameLayout {
  const hudCenterFromTop = topInset + 70;
  const minimumBoardTop = hudCenterFromTop + 46 + 58;
  const instructionAllowance = 86;
  const availableBoardHeight = Math.max(0, uiHeight - bottomInset - instructionAllowance - minimumBoardTop);
  const widthScale = Math.max(0, (uiWidth - 32) / boardPixels);
  const boardScale = Math.max(0.72, Math.min(1, widthScale, availableBoardHeight / boardPixels));
  const displaySize = boardPixels * boardScale;
  const preferredBoardTop = uiHeight / 2 - 100 - displaySize / 2;
  const maximumBoardTop = uiHeight - bottomInset - instructionAllowance - displaySize;
  const boardTop = Math.max(minimumBoardTop, Math.min(maximumBoardTop, preferredBoardTop));
  return {
    hudCenterFromTop,
    boardTop,
    boardScale,
    instructionCenterFromTop: boardTop + displaySize + 52,
  };
}
