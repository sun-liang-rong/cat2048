import { describe, expect, it, vi } from 'vitest';

vi.mock('cc', () => ({
  EventTouch: class EventTouch {},
  Node: { EventType: { TOUCH_START: 'touch-start', TOUCH_CANCEL: 'touch-cancel', TOUCH_END: 'touch-end' } },
  Vec2: class Vec2 {},
}));

import { directionFromDelta } from '../assets/scripts/ui/components/SwipeInput';

describe('directionFromDelta', () => {
  it('returns null under threshold', () => {
    expect(directionFromDelta(10, 0, 42)).toBeNull();
  });
  it('picks dominant axis', () => {
    expect(directionFromDelta(50, 10, 42)).toBe('right');
    expect(directionFromDelta(-50, 10, 42)).toBe('left');
    expect(directionFromDelta(10, 50, 42)).toBe('up');
    expect(directionFromDelta(10, -50, 42)).toBe('down');
  });
});
