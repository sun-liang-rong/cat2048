/**
 * 游戏基础数值常量（纯值，无依赖）。
 *
 * 与规则函数分离：本文件只放可独立引用的数字常量。
 */
export const SPAWN_LEVEL_1_PROBABILITY = 0.9 as const;
export const SPAWN_LEVEL_2_PROBABILITY = 0.1 as const;
/** 复活时移除的最低等级猫咪数量。 */
export const REVIVE_REMOVE_TILE_COUNT = 2 as const;
