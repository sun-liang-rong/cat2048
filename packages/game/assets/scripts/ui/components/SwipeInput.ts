import { EventTouch, Node, Vec2 } from 'cc';
import type { Direction } from '../../core/types';
import { GAME_CONFIG } from '../../core/config/gameConfig';

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
  private board: Node | null = null;
  private readonly onTouchStartHandler = (event: EventTouch): void => {
    if (this.isLocked()) {
      this.cancelActiveTouch();
      return;
    }
    this.touchStart = event.getUILocation();
    const ui = event.getUILocation();
    const local = this.toLocal?.(ui.x, ui.y);
    if (local) this.onTouchStartLocal?.(local.x, local.y);
  };
  private readonly onTouchCancelHandler = (): void => {
    this.cancelActiveTouch();
  };
  private readonly onTouchEndHandler = (event: EventTouch): void => {
    const start = this.touchStart;
    // Always clear gesture state first so cancel/end never leave a dangling start.
    this.cancelActiveTouch();
    if (!start || this.isLocked()) return;
    const end = event.getUILocation();
    const direction = directionFromDelta(
      end.x - start.x,
      end.y - start.y,
      GAME_CONFIG.swipeThreshold,
    );
    if (direction) this.onSwipe(direction);
  };
  private toLocal: ((uiX: number, uiY: number) => { x: number; y: number } | null) | null = null;

  public constructor(
    private readonly isLocked: () => boolean,
    private readonly onSwipe: SwipeHandler,
    private readonly onTouchStartLocal?: (localX: number, localY: number) => void,
    private readonly onTouchEndOrCancel?: () => void,
  ) {}

  public bind(board: Node, toLocal: (uiX: number, uiY: number) => { x: number; y: number } | null): void {
    this.unbind();
    this.board = board;
    this.toLocal = toLocal;
    board.on(Node.EventType.TOUCH_START, this.onTouchStartHandler);
    board.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancelHandler);
    board.on(Node.EventType.TOUCH_END, this.onTouchEndHandler);
  }

  /** Remove listeners and clear any in-flight gesture. Safe to call repeatedly. */
  public unbind(): void {
    if (this.board) {
      this.board.off(Node.EventType.TOUCH_START, this.onTouchStartHandler);
      this.board.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancelHandler);
      this.board.off(Node.EventType.TOUCH_END, this.onTouchEndHandler);
      this.board = null;
    }
    this.toLocal = null;
    this.cancelActiveTouch();
  }

  public reset(): void {
    this.cancelActiveTouch();
  }

  private cancelActiveTouch(): void {
    const hadGesture = this.touchStart !== null;
    this.touchStart = null;
    // Always clear highlight on cancel/reset so UI never sticks after leave/dialog/lock.
    if (hadGesture || this.board) this.onTouchEndOrCancel?.();
  }
}
