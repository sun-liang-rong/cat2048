/**
 * 每日挑战规则（从 GameFlowController 拆出的纯逻辑）。
 */
import type { SavedRunMode } from '../storage/runSession';

export const DAILY_CHALLENGE_TARGET_LEVEL = 5;

export interface DailyChallengeView {
  readonly targetLevel: number;
  readonly completed: boolean;
}

/** 是否应把本次合成标记为完成每日挑战。 */
export function shouldCompleteDailyChallenge(mode: SavedRunMode, completed: boolean,
  highestLevel: number): boolean {
  return mode === 'daily-challenge' && !completed
    && highestLevel >= DAILY_CHALLENGE_TARGET_LEVEL;
}

/** 进化面板的挑战展示数据（非每日挑战模式返回 undefined）。 */
export function evolutionChallengeFor(mode: SavedRunMode,
  completed: boolean): DailyChallengeView | undefined {
  if (mode !== 'daily-challenge') return undefined;
  return {
    targetLevel: DAILY_CHALLENGE_TARGET_LEVEL,
    completed,
  };
}
