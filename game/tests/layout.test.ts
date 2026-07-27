import { describe, expect, it } from 'vitest';
import {
  capsuleBottomInset,
  gameLayout,
  homeContentShift,
  safeInsetsFromRect,
} from '../assets/scripts/presentation/layout';

describe('portrait layout', () => {
  it('uses Cocos safe-area coordinates without applying device pixel ratio twice', () => {
    expect(safeInsetsFromRect(1600, { x: 0, y: 28, width: 750, height: 1512 }))
      .toEqual({ top: 60, bottom: 28 });
  });

  it('converts the WeChat capsule from window pixels to design units', () => {
    expect(capsuleBottomInset(750, { windowWidth: 375 }, { bottom: 56 })).toBe(128);
  });

  it('moves home content into the center of tall-screen free space', () => {
    expect(homeContentShift(1600, 128, 28)).toBeGreaterThan(180);
    expect(homeContentShift(1100, 128, 28)).toBe(0);
  });

  it('keeps the board between the capsule and bottom safe area', () => {
    const tall = gameLayout(750, 1600, 128, 28, 690);
    expect(tall.boardScale).toBe(1);
    expect(tall.boardTop).toBeGreaterThan(tall.hudCenterFromTop + 46);
    expect(tall.instructionCenterFromTop + 28).toBeLessThan(1600 - 28);

    const short = gameLayout(750, 1100, 128, 28, 690);
    expect(short.boardScale).toBeLessThan(1);
    expect(short.instructionCenterFromTop + 28).toBeLessThan(1100 - 28);
  });
});
