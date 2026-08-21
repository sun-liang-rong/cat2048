import type { Position } from '../../core/types';

export const BOARD_PIXELS = 690;
export const BOARD_PADDING = 40;
export const CELL_GAP = 10;
export const CELL_SIZE = (BOARD_PIXELS - BOARD_PADDING * 2 - CELL_GAP * 3) / 4;

/** Board-local center for a grid cell. Origin is board center; +Y is up. */
export function cellCenter({ row, col }: Position): { x: number; y: number } {
  const start = -BOARD_PIXELS / 2 + BOARD_PADDING + CELL_SIZE / 2;
  return {
    x: start + col * (CELL_SIZE + CELL_GAP),
    y: -start - row * (CELL_SIZE + CELL_GAP),
  };
}
