import { describe, expect, it } from 'vitest';
import { collectionLayout } from '../assets/scripts/ui/styles/collectionLayout';

describe('cat encyclopedia layout', () => {
  it('lays twelve entries out as a scrollable three-column portrait grid', () => {
    const layout = collectionLayout(750, 1334, 128, 28, 12);

    expect(layout.columns).toBe(3);
    expect(layout.rows).toBe(4);
    expect(layout.cardWidth).toBe(200);
    expect(layout.gridWidth).toBeLessThanOrEqual(750 - 56);
    expect(layout.contentHeight).toBeGreaterThan(layout.viewportHeight);
  });

  it('keeps the header and collection viewport inside both safe areas', () => {
    const layout = collectionLayout(750, 1100, 128, 28, 12);
    const safeTopY = 1100 / 2 - 128;
    const safeBottomY = -1100 / 2 + 28;

    expect(layout.headerY).toBeLessThan(safeTopY);
    expect(layout.headerY).toBeGreaterThan(layout.progressY);
    expect(layout.progressY).toBeGreaterThan(layout.viewportTop);
    expect(layout.viewportBottom).toBeGreaterThan(safeBottomY);
    expect(layout.viewportHeight).toBeGreaterThan(0);
  });

  it('shrinks cards on narrow screens while preserving three columns', () => {
    const layout = collectionLayout(540, 960, 96, 20, 12);

    expect(layout.columns).toBe(3);
    expect(layout.cardWidth).toBeLessThan(200);
    expect(layout.gridWidth).toBeLessThanOrEqual(540 - 56);
  });
});
