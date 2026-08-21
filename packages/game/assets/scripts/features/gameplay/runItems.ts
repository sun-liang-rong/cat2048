/**
 * 对局道具消耗规则（从 GameFlowController 拆出的纯逻辑）。
 */

/** 计算本局实际消耗的分享补充道具数量（与每局基础 1 次叠加）。 */
export function usedBonusItems(bonus: number, initial: number, remaining: number): number {
  return Math.max(0, Math.min(bonus, initial - remaining - 1));
}
