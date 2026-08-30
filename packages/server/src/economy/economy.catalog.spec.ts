import { describe, expect, it } from 'vitest';
import {
  calculateDailyReward,
  calculateRunReward,
  DAILY_TASK_REWARDS,
  findCosmetic,
  ITEM_DAILY_AD_MAX,
  ITEM_HOLDING_MAX,
  MAX_MIGRATABLE_COINS,
} from './economy.catalog';

describe('economy catalog rules', () => {
  it('keeps run rewards bounded and deterministic', () => {
    expect(calculateRunReward(0, 1)).toBe(5);
    expect(calculateRunReward(1000, 5)).toBe(20);
    expect(calculateRunReward(0, 12)).toBe(150);
    expect(calculateRunReward(Number.MAX_SAFE_INTEGER, 12)).toBe(150);
  });

  it('calculates daily rewards from the completed streak', () => {
    expect(calculateDailyReward(0)).toBe(30);
    expect(calculateDailyReward(1)).toBe(40);
    expect(calculateDailyReward(99)).toBe(100);
  });

  it('uses a server-owned catalog and migration cap', () => {
    expect(findCosmetic('cat-skin.sunny')?.price).toBe(800);
    expect(findCosmetic('not-a-product')).toBeUndefined();
    expect(MAX_MIGRATABLE_COINS).toBe(100_000);
    expect(DAILY_TASK_REWARDS['play-3']).toBe(30);
  });

  it('matches the gameplay item limits', () => {
    expect(ITEM_HOLDING_MAX).toEqual({ undo: 5, spawn: 3, shuffle: 2, erase: 2 });
    expect(ITEM_DAILY_AD_MAX).toEqual({ undo: 3, spawn: 3, shuffle: 2, erase: 1 });
  });
});
