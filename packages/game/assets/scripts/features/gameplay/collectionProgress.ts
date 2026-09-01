/**
 * 图鉴解锁与奖励规则（从 GameFlowController 拆出的纯逻辑）。
 */
import { GAME_CONFIG } from '../../core/config/gameConfig';

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

/**
 * 图鉴等级是单调且连续的：合成出更高等级时，中间等级必然已经出现过。
 * 合并本地与服务端状态时补齐中间等级，避免异步同步把已解锁等级撕出断档。
 */
export function mergeCollectionLevels(...sources: readonly (readonly number[])[]): number[] {
  const levels: number[] = [];
  for (const source of sources) {
    for (const level of source) {
      if (Number.isInteger(level) && level >= 1 && level <= GAME_CONFIG.cats.length) {
        levels.push(level);
      }
    }
  }
  const highest = Math.max(1, ...levels);
  return Array.from({ length: highest }, (_, index) => index + 1);
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
