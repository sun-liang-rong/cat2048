import { describe, expect, it } from 'vitest';
import {
  displayNameOf,
  formatDateText,
  formatScore,
  initialOf,
} from '../assets/scripts/ui/utils/format';

describe('formatScore', () => {
  it('adds thousands separators', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999)).toBe('999');
    expect(formatScore(1000)).toBe('1,000');
    expect(formatScore(1234567)).toBe('1,234,567');
  });
});

describe('formatDateText', () => {
  it('formats ISO date strings as X月Y日', () => {
    expect(formatDateText('2026-08-20T12:00:00.000Z')).toBe('8月20日');
    expect(formatDateText('2026-01-05')).toBe('1月5日');
  });

  it('returns empty string for unparseable input', () => {
    expect(formatDateText('')).toBe('');
    expect(formatDateText('not-a-date')).toBe('');
  });
});

describe('initialOf', () => {
  it('returns the first character of a trimmed nickname', () => {
    expect(initialOf('喵喵侠')).toBe('喵');
    expect(initialOf('  abc ')).toBe('a');
  });

  it('falls back to 玩 for empty nicknames', () => {
    expect(initialOf(null)).toBe('玩');
    expect(initialOf('')).toBe('玩');
    expect(initialOf('   ')).toBe('玩');
  });
});

describe('displayNameOf', () => {
  it('uses the trimmed nickname when present', () => {
    expect(displayNameOf('喵喵侠', 'p1234')).toBe('喵喵侠');
    expect(displayNameOf(' 喵喵 ', 'p1234')).toBe('喵喵');
  });

  it('falls back to player id suffix', () => {
    expect(displayNameOf(null, 'player-abc123')).toBe('玩家-c123');
    expect(displayNameOf('', 'player-xyz9')).toBe('玩家-xyz9');
  });
});
