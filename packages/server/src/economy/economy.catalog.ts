export interface ServerCosmetic {
  readonly id: string;
  readonly category: 'cat-skin' | 'board' | 'effect';
  readonly price: number;
}

/**
 * 商品目录的服务端副本。客户端只负责展示资源，购买时价格和分类以这里为准。
 * 变更商品价格或新增商品时请同步递增 CATALOG_VERSION。
 */
export const CATALOG_VERSION = '2026-08-01';

/** 当前客户端本地经济数据迁移版本；升级迁移必须增加专门的服务端规则。 */
export const CURRENT_MIGRATION_VERSION = 1;

export const DEFAULT_ITEM_IDS = [
  'cat-skin.default',
  'board.wood',
  'effect.classic',
] as const;

export const DEFAULT_EQUIPPED = {
  catSkin: 'cat-skin.default',
  board: 'board.wood',
  effect: 'effect.classic',
} as const;

export const COSMETICS: readonly ServerCosmetic[] = [
  { id: 'cat-skin.default', category: 'cat-skin', price: 0 },
  { id: 'board.wood', category: 'board', price: 0 },
  { id: 'effect.classic', category: 'effect', price: 0 },
  { id: 'cat-skin.sunny', category: 'cat-skin', price: 800 },
  { id: 'cat-skin.costume', category: 'cat-skin', price: 900 },
  { id: 'cat-skin.ocean', category: 'cat-skin', price: 1000 },
  { id: 'cat-skin.dream', category: 'cat-skin', price: 1500 },
  { id: 'cat-skin.jiguang', category: 'cat-skin', price: 1800 },
  { id: 'board.pink', category: 'board', price: 250 },
  { id: 'board.star', category: 'board', price: 500 },
  { id: 'effect.aurora', category: 'effect', price: 300 },
  { id: 'effect.stars', category: 'effect', price: 600 },
];

export const ITEM_HOLDING_MAX: Record<'undo' | 'spawn' | 'shuffle' | 'erase', number> = {
  undo: 1,
  spawn: 3,
  shuffle: 2,
  erase: 2,
};

export const ITEM_DAILY_AD_MAX: Record<'undo' | 'spawn' | 'shuffle' | 'erase', number> = {
  undo: 3,
  spawn: 3,
  shuffle: 2,
  erase: 1,
};

export const COLLECTION_REWARDS = [
  { count: 3, coins: 200 },
  { count: 6, coins: 400 },
  { count: 9, coins: 600 },
  { count: 12, coins: 800 },
] as const;

export const MAX_COLLECTION_LEVEL = 12;
export const MAX_MIGRATABLE_COINS = 100_000;

export const DAILY_TASK_REWARDS: Readonly<Record<string, number>> = {
  'play-3': 30,
  'reach-lv5': 30,
  'use-items-2': 20,
  'share-1': 20,
};

export function findCosmetic(id: string): ServerCosmetic | undefined {
  return COSMETICS.find((item) => item.id === id);
}

export function calculateRunReward(score: number, highestLevel: number): number {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const safeLevel = Math.max(1, Math.min(MAX_COLLECTION_LEVEL, Math.floor(highestLevel)));
  const baseReward = Math.max(5, Math.floor(safeScore / 100));
  const levelBonus = (safeLevel >= 5 ? 10 : 0)
    + (safeLevel >= 7 ? 20 : 0)
    + (safeLevel >= 9 ? 50 : 0)
    + (safeLevel >= 11 ? 35 : 0)
    + (safeLevel >= 12 ? 35 : 0);
  return Math.min(150, baseReward + levelBonus);
}

export function calculateDailyReward(completedStreak: number): number {
  return Math.min(100, 30 + Math.max(0, Math.floor(completedStreak)) * 10);
}
