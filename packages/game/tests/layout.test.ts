import { describe, expect, it } from 'vitest';
import {
  capsuleBottomInset,
  gameLayout,
  homeActionDockPositions,
  safeInsetsFromRect,
  spriteCropTransform,
} from '../assets/scripts/ui/styles/layout';

describe('portrait layout', () => {
  it('centers five home dock actions with equal spacing', () => {
    expect(homeActionDockPositions(5)).toEqual([-232, -116, 0, 116, 232]);
  });

  it('uses Cocos safe-area coordinates without applying device pixel ratio twice', () => {
    expect(safeInsetsFromRect(1600, { x: 0, y: 28, width: 750, height: 1512 }))
      .toEqual({ top: 60, bottom: 28 });
  });

  it('converts the WeChat capsule from window pixels to design units', () => {
    expect(capsuleBottomInset(750, { windowWidth: 375 }, { bottom: 56 })).toBe(128);
  });

  it('places a one-hand board and item bar between the HUD and bottom safe area', () => {
    const tall = gameLayout(750, 1600, 128, 28, 690);
    expect(tall.boardScale).toBe(1);
    expect(tall.boardTop).toBeGreaterThan(tall.hudCenterFromTop + 46);
    expect(tall.boardTop).toBeGreaterThan(430);
    expect(tall.evolutionPanelHeight).toBe(204);
    expect(tall.evolutionPanelCenterFromTop + tall.evolutionPanelHeight / 2)
      .toBeLessThan(tall.boardTop);
    expect(tall.statsBarHeight).toBe(62);
    expect(tall.statsBarCenterFromTop - tall.statsBarHeight / 2)
      .toBeGreaterThan(tall.evolutionPanelCenterFromTop + tall.evolutionPanelHeight / 2);
    expect(tall.statsBarCenterFromTop + tall.statsBarHeight / 2).toBeLessThan(tall.boardTop);
    expect(tall.boardTop - (tall.statsBarCenterFromTop + tall.statsBarHeight / 2)).toBe(18);
    expect(tall.itemBarCenterFromTop - 48).toBeGreaterThan(tall.boardTop + 690);
    expect(tall.itemBarCenterFromTop + 48).toBeLessThan(1600 - 28);

    // 中等屏幕：进化面板需要收缩，但 stats bar 必须保留。
    const short = gameLayout(750, 1100, 128, 28, 690);
    expect(short.boardScale).toBeLessThan(1);
    const shortBoardBottom = short.boardTop + 690 * short.boardScale;
    expect(short.statsBarHeight).toBe(62);
    expect(short.statsBarCenterFromTop + short.statsBarHeight / 2)
      .toBeLessThanOrEqual(short.boardTop);
    expect(short.statsBarCenterFromTop - short.statsBarHeight / 2)
      .toBeGreaterThanOrEqual(short.hudCenterFromTop + 46 + 14);
    expect(short.itemBarCenterFromTop - 48).toBeGreaterThan(shortBoardBottom);
    expect(short.itemBarCenterFromTop + 48).toBeLessThan(1100 - 28);

    // 紧凑屏幕：进化面板彻底收起，棋盘缩到最小，但 stats bar 仍贴 board 上方。
    const compact = gameLayout(750, 900, 128, 28, 690);
    expect(compact.boardScale).toBeLessThan(0.72);
    expect(compact.evolutionPanelHeight).toBe(0);
    expect(compact.statsBarHeight).toBe(62);
    expect(compact.statsBarCenterFromTop + compact.statsBarHeight / 2)
      .toBeLessThanOrEqual(compact.boardTop);
    expect(compact.statsBarCenterFromTop - compact.statsBarHeight / 2)
      .toBeGreaterThanOrEqual(compact.hudCenterFromTop + 46 + 14);
    expect(compact.boardTop - (compact.statsBarCenterFromTop + compact.statsBarHeight / 2)).toBe(18);
    expect(compact.boardTop).toBeGreaterThanOrEqual(compact.hudCenterFromTop + 46 + 58);
    expect(compact.itemBarCenterFromTop - 48)
      .toBeGreaterThan(compact.boardTop + 690 * compact.boardScale);
    expect(compact.itemBarCenterFromTop + 48).toBeLessThanOrEqual(900 - 28 - 24);
  });

  it('moves sprite-sheet edge artifacts outside the clipped icon viewport', () => {
    expect(spriteCropTransform(64, 160, 160, { x: 4, y: 0, width: 144, height: 144 }))
      .toEqual({ width: 640 / 9, height: 640 / 9, x: 16 / 9, y: -32 / 9 });
    expect(spriteCropTransform(64, 160, 160, { x: 4, y: 16, width: 144, height: 144 }))
      .toEqual({ width: 640 / 9, height: 640 / 9, x: 16 / 9, y: 32 / 9 });
  });
});
