/**
 * 游戏基础数值常量（纯值，无依赖）。
 *
 * 与规则函数分离：本文件只放可独立引用的数字常量。
 */
export const SPAWN_LEVEL_1_PROBABILITY = 0.9 as const;
export const SPAWN_LEVEL_2_PROBABILITY = 0.1 as const;
/** 复活时移除的最低等级猫咪数量。 */
export const REVIVE_REMOVE_TILE_COUNT = 2 as const;

/** 道具系统常量 */
/** 每局最多使用道具总次数 */
export const ITEM_PER_GAME_MAX = 2 as const;
/** 每种道具每局最多使用次数 */
export const ITEM_PER_GAME_LIMIT: Record<string, number> = {
  undo: 1,
  spawn: 1,
  shuffle: 1,
  erase: 1,
} as const;
/** 每种道具全局持有上限 */
export const ITEM_HOLDING_MAX: Record<string, number> = {
  undo: 5,
  spawn: 3,
  shuffle: 2,
  erase: 2,
} as const;
/** 每种道具每日广告获取上限 */
export const ITEM_DAILY_AD_MAX: Record<string, number> = {
  undo: 3,
  spawn: 3,
  shuffle: 2,
  erase: 1,
} as const;
