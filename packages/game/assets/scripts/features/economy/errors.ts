/**
 * 经济系统错误文案（从 Cat2048Boot 拆出）。
 */
import type { EconomyMutationResult } from './economy';

/** 将经济操作结果映射为用户可见的错误文案。 */
export function economyErrorText(result: EconomyMutationResult): string {
  if (result.reason === 'insufficient-coins') return '金币不足';
  if (result.reason === 'already-owned') return '该装饰已拥有';
  return '装饰操作失败';
}
