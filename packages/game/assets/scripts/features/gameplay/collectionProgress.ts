/**
 * 图鉴解锁与奖励规则（从 GameFlowController 拆出的纯逻辑）。
 */
export const COLLECTION_REWARDS = [
  { count: 3, coins: 200 },
  { count: 6, coins: 400 },
  { count: 9, coins: 600 },
  { count: 12, coins: 800 },
] as const;

export interface CollectionProgressResult {
  readonly newLevels: readonly number[];
  readonly previousCount: number;
  readonly nextCount: number;
  readonly rewardCoins: number;
}

/** 计算棋盘上新增解锁的猫咪等级与对应图鉴奖励（不含存档副作用）。 */
export function calculateCollectionProgress(tileLevels: readonly number[],
  unlockedLevels: readonly number[]): CollectionProgressResult {
  const unlocked = new Set(unlockedLevels);
  const newLevels = Array.from(new Set(tileLevels))
    .filter((level) => !unlocked.has(level))
    .sort((a, b) => a - b);
  if (newLevels.length === 0) {
    return { newLevels, previousCount: unlocked.size, nextCount: unlocked.size, rewardCoins: 0 };
  }
  const previousCount = unlocked.size;
  for (const level of newLevels) unlocked.add(level);
  const nextCount = unlocked.size;
  let rewardCoins = 0;
  for (const reward of COLLECTION_REWARDS) {
    if (previousCount < reward.count && nextCount >= reward.count) {
      rewardCoins += reward.coins;
    }
  }
  return { newLevels, previousCount, nextCount, rewardCoins };
}
