import { describe, expect, it } from 'vitest';
import {
  DAILY_CHALLENGE_TARGET_LEVEL,
  evolutionChallengeFor,
  shouldCompleteDailyChallenge,
} from '../assets/scripts/features/gameplay/dailyChallenge';
import {
  COLLECTION_REWARDS,
  calculateCollectionProgress,
} from '../assets/scripts/features/gameplay/collectionProgress';
import { usedBonusItems } from '../assets/scripts/features/gameplay/runItems';

describe('dailyChallenge', () => {
  it('marks completion only in daily-challenge mode at target level', () => {
    expect(shouldCompleteDailyChallenge('daily-challenge', false, DAILY_CHALLENGE_TARGET_LEVEL)).toBe(true);
    expect(shouldCompleteDailyChallenge('daily-challenge', false, DAILY_CHALLENGE_TARGET_LEVEL - 1)).toBe(false);
    expect(shouldCompleteDailyChallenge('daily-challenge', true, DAILY_CHALLENGE_TARGET_LEVEL)).toBe(false);
    expect(shouldCompleteDailyChallenge('classic', false, DAILY_CHALLENGE_TARGET_LEVEL)).toBe(false);
  });

  it('builds challenge view only for daily-challenge mode', () => {
    expect(evolutionChallengeFor('daily-challenge', false)).toEqual({
      targetLevel: DAILY_CHALLENGE_TARGET_LEVEL,
      completed: false,
    });
    expect(evolutionChallengeFor('daily-challenge', true)?.completed).toBe(true);
    expect(evolutionChallengeFor('classic', false)).toBeUndefined();
  });
});

describe('calculateCollectionProgress', () => {
  it('reports new levels and updated counts', () => {
    const result = calculateCollectionProgress([3, 1, 2], [1]);
    expect(result.newLevels).toEqual([2, 3]);
    expect(result.previousCount).toBe(1);
    expect(result.nextCount).toBe(3);
  });

  it('returns empty when no new levels', () => {
    const result = calculateCollectionProgress([1, 1], [1, 2]);
    expect(result.newLevels).toEqual([]);
    expect(result.rewardCoins).toBe(0);
  });

  it('awards coins when crossing reward thresholds', () => {
    // 从 2 个解锁到 4 个 → 越过 count 3 门槛
    const result = calculateCollectionProgress([1, 2, 3, 4], [1, 2]);
    const expected = COLLECTION_REWARDS
      .filter((reward) => reward.count === 3)
      .reduce((sum, reward) => sum + reward.coins, 0);
    expect(result.rewardCoins).toBe(expected);
  });

  it('deduplicates tile levels', () => {
    const result = calculateCollectionProgress([5, 5, 5], [1]);
    expect(result.newLevels).toEqual([5]);
    expect(result.nextCount).toBe(2);
  });
});

describe('usedBonusItems', () => {
  it('computes consumed bonus items within bounds', () => {
    // bonus 3, initial 4 (1 base + 3 bonus), remaining 2 → 用了 4-2-1=1 个 bonus
    expect(usedBonusItems(3, 4, 2)).toBe(1);
    // bonus 全用：remaining 1 → 4-1-1=2
    expect(usedBonusItems(3, 4, 1)).toBe(2);
    // 未使用 bonus
    expect(usedBonusItems(3, 4, 4)).toBe(0);
    // 不会超过 bonus 上限
    expect(usedBonusItems(1, 2, 0)).toBe(1);
  });
});
