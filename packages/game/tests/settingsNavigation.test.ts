import { describe, expect, it } from 'vitest';
import { settingsOrigin } from '../assets/scripts/ui/utils/settingsNavigation';

describe('settingsOrigin', () => {
  it('returns to the current board when settings opened during a game', () => {
    expect(settingsOrigin(true)).toBe('game');
  });

  it('refreshes home when settings opened from home', () => {
    expect(settingsOrigin(false)).toBe('home');
  });
});
