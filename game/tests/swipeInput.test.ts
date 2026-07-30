import { describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, Array<(...args: unknown[]) => void>>();

vi.mock('cc', () => {
  class FakeNode {
    public static EventType = {
      TOUCH_START: 'touch-start',
      TOUCH_CANCEL: 'touch-cancel',
      TOUCH_END: 'touch-end',
    };

    public on(type: string, handler: (...args: unknown[]) => void): void {
      const list = handlers.get(type) ?? [];
      list.push(handler);
      handlers.set(type, list);
    }

    public off(type: string, handler: (...args: unknown[]) => void): void {
      const list = handlers.get(type) ?? [];
      handlers.set(type, list.filter((item) => item !== handler));
    }
  }

  class FakeVec2 {
    public constructor(public x = 0, public y = 0) {}
  }

  class FakeEventTouch {
    public constructor(private readonly point: { x: number; y: number }) {}
    public getUILocation(): { x: number; y: number } {
      return this.point;
    }
  }

  return {
    EventTouch: FakeEventTouch,
    Node: FakeNode,
    Vec2: FakeVec2,
  };
});

import { EventTouch, Node } from 'cc';
import { SwipeInput } from '../assets/scripts/presentation/SwipeInput';

function emit(type: string, event?: EventTouch): void {
  for (const handler of handlers.get(type) ?? []) handler(event);
}

describe('SwipeInput cancel / lock state', () => {
  it('clears gesture state on cancel and does not fire swipe later', () => {
    handlers.clear();
    const onSwipe = vi.fn();
    const onStart = vi.fn();
    const onEndOrCancel = vi.fn();
    const swipe = new SwipeInput(() => false, onSwipe, onStart, onEndOrCancel);
    const board = new Node() as unknown as Node;
    swipe.bind(board, (x, y) => ({ x, y }));

    emit(Node.EventType.TOUCH_START, new EventTouch({ x: 0, y: 0 }) as EventTouch);
    expect(onStart).toHaveBeenCalledWith(0, 0);

    emit(Node.EventType.TOUCH_CANCEL);
    expect(onEndOrCancel).toHaveBeenCalledTimes(1);

    // A subsequent end with large delta must not swipe after cancel cleared start.
    emit(Node.EventType.TOUCH_END, new EventTouch({ x: 100, y: 0 }) as EventTouch);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('clears highlight even when end happens while locked', () => {
    handlers.clear();
    let locked = false;
    const onSwipe = vi.fn();
    const onEndOrCancel = vi.fn();
    const swipe = new SwipeInput(() => locked, onSwipe, undefined, onEndOrCancel);
    swipe.bind(new Node() as unknown as Node, () => ({ x: 0, y: 0 }));

    emit(Node.EventType.TOUCH_START, new EventTouch({ x: 0, y: 0 }) as EventTouch);
    locked = true;
    emit(Node.EventType.TOUCH_END, new EventTouch({ x: 100, y: 0 }) as EventTouch);

    expect(onEndOrCancel).toHaveBeenCalledTimes(1);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('unbind removes listeners and clears active gesture', () => {
    handlers.clear();
    const onSwipe = vi.fn();
    const onEndOrCancel = vi.fn();
    const swipe = new SwipeInput(() => false, onSwipe, undefined, onEndOrCancel);
    swipe.bind(new Node() as unknown as Node, () => ({ x: 0, y: 0 }));

    emit(Node.EventType.TOUCH_START, new EventTouch({ x: 0, y: 0 }) as EventTouch);
    swipe.unbind();
    expect(onEndOrCancel).toHaveBeenCalledTimes(1);

    emit(Node.EventType.TOUCH_END, new EventTouch({ x: 120, y: 0 }) as EventTouch);
    expect(onSwipe).not.toHaveBeenCalled();
    expect(handlers.get(Node.EventType.TOUCH_END) ?? []).toHaveLength(0);
  });
});
