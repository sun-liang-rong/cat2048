/**
 * 展示格式化工具（纯函数，无 UI 依赖）。
 */

/** 数字千分位格式化：1234567 → "1,234,567"。 */
export const formatScore = (score: number): string =>
  String(score).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 日期格式化：ISO 字符串 → "X月Y日"，无法解析时返回空串。 */
export const formatDateText = (achievedAt: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(achievedAt);
  if (!match) return '';
  return `${Number(match[2])}月${Number(match[3])}日`;
};

/** 昵称首字符（用于头像占位），无昵称时用 "玩"。 */
export const initialOf = (nickname: string | null): string =>
  nickname?.trim().slice(0, 1) || '玩';

/** 展示名：有昵称用昵称，否则用玩家 ID 后四位。 */
export const displayNameOf = (nickname: string | null, playerId: string): string =>
  nickname?.trim() || `玩家-${playerId.slice(-4)}`;
