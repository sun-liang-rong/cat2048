import { describe, expect, it } from 'vitest';
import {
  BOARD_PADDING,
  BOARD_PIXELS,
  CELL_GAP,
  CELL_SIZE,
  cellCenter,
} from '../assets/scripts/presentation/boardGeometry';

describe('boardGeometry', () => {
  it('derives cell size from board pixels, padding, and gaps', () => {
    expect(BOARD_PIXELS).toBe(690);
    expect(BOARD_PADDING).toBe(18);
    expect(CELL_GAP).toBe(10);
    expect(CELL_SIZE).toBe((BOARD_PIXELS - BOARD_PADDING * 2 - CELL_GAP * 3) / 4);
  });

  it('maps row/col to board-local centers with row 0 at the top', () => {
    const topLeft = cellCenter({ row: 0, col: 0 });
    const bottomRight = cellCenter({ row: 3, col: 3 });
    const start = -BOARD_PIXELS / 2 + BOARD_PADDING + CELL_SIZE / 2;

    expect(topLeft).toEqual({ x: start, y: -start });
    expect(bottomRight).toEqual({
      x: start + 3 * (CELL_SIZE + CELL_GAP),
      y: -start - 3 * (CELL_SIZE + CELL_GAP),
    });
  });
});
