import { EventTouch, Node, Vec2 } from 'cc';
import type { Direction } from '../core/types';
import { GAME_CONFIG } from '../infrastructure/gameConfig';

export type SwipeHandler = (direction: Direction) => void;

/** Pure swipe direction from a delta; null when under threshold. */
export function directionFromDelta(dx: number, dy: number, threshold: number): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  return Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'up' : 'down');
}

export class SwipeInput {
  private touchStart: Vec2 | null = null;

  public constructor(
    private readonly isLocked: () => boolean,
    private readonly onSwipe: SwipeHandler,
    private readonly onTouchStartLocal?: (localX: number, localY: number) => void,
    private readonly onTouchEndOrCancel?: () => void,
  ) {}

  public bind(board: Node, toLocal: (uiX: number, uiY: number) => { x: number; y: number } | null): void {
    board.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      if (this.isLocked()) return;
      this.touchStart = event.getUILocation();
      const ui = event.getUILocation();
      const local = toLocal(ui.x, ui.y);
      if (local) this.onTouchStartLocal?.(local.x, local.y);
    });
    board.on(Node.EventType.TOUCH_CANCEL, () => {
      this.touchStart = null;
      this.onTouchEndOrCancel?.();
    });
    board.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      this.onTouchEndOrCancel?.();
      if (!this.touchStart || this.isLocked()) return;
      const end = event.getUILocation();
      const dx = end.x - this.touchStart.x;
      const dy = end.y - this.touchStart.y;
      this.touchStart = null;
      const direction = directionFromDelta(dx, dy, GAME_CONFIG.swipeThreshold);
      if (direction) this.onSwipe(direction);
    });
  }

  public reset(): void {
    this.touchStart = null;
  }
}
