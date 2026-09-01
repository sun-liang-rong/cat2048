/**
 * 对局道具消耗规则（从 GameFlowController 拆出的纯逻辑）。
 */

import type { ItemKind } from '../../core/types';

/** 本局已使用的道具种类列表 */
export function usedItemKindsList(usedKinds: readonly ItemKind[]): ItemKind[] {
  return [...usedKinds];
}

/** 检查本局是否还能使用指定道具 */
export function canUseItemInRun(
  kind: ItemKind,
  usedKinds: readonly ItemKind[],
  maxTotal: number,
  maxPerKind: Record<string, number>,
): boolean {
  if (kind === 'undo' || kind === 'erase') return true;
  if (usedKinds.includes(kind)) return false;
  if (usedKinds.length >= maxTotal) return false;
  const kindCount = usedKinds.filter((k) => k === kind).length;
  if (kindCount >= (maxPerKind[kind] ?? 0)) return false;
  return true;
}
