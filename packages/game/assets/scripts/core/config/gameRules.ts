/**
 * 游戏规则（与数值常量分离，表达"规则"而非"数值"）。
 */
import { MAX_LEVEL } from '../types';
import {
  REVIVE_REMOVE_TILE_COUNT,
  SPAWN_LEVEL_1_PROBABILITY,
} from './constants';

/** 合成得分：合成到 Lv.n 得 2^n 分。 */
export const scoreForLevel = (level: number): number => 2 ** level;

/** 新方块等级随机：90% Lv.1，10% Lv.2（roll 需在 [0,1)）。 */
export const rollSpawnLevel = (roll: number): number =>
  roll < SPAWN_LEVEL_1_PROBABILITY ? 1 : 2;

/** 复活操作移除的最低等级猫咪数量。 */
export const REVIVE_REMOVE_COUNT = REVIVE_REMOVE_TILE_COUNT;

/** 最高可合成等级（超出则不再合成）。 */
export const MAX_MERGE_LEVEL = MAX_LEVEL;
