import { describe, expect, it } from 'vitest';
import {
  allCosmetics,
  DEFAULT_ECONOMY,
  DEFAULT_EQUIPPED,
  SHOP_ITEMS,
} from '../assets/scripts/economy/catalog';

describe('cosmetic catalog', () => {
  it('contains the four planned cosmetic categories and stable prices', () => {
    expect(SHOP_ITEMS.map((item) => item.category)).toEqual([
      'cat-skin', 'cat-skin', 'board', 'board', 'effect', 'effect', 'button-theme', 'button-theme',
    ]);
    expect(SHOP_ITEMS.map((item) => item.price)).toEqual([800, 1200, 250, 500, 300, 600, 180, 360]);
  });

  it('starts with one owned and equipped default per category', () => {
    expect(DEFAULT_ECONOMY.coins).toBe(100);
    expect(DEFAULT_ECONOMY.ownedItemIds).toEqual(Object.keys(DEFAULT_EQUIPPED).map((key) => {
      const value = DEFAULT_EQUIPPED[key as keyof typeof DEFAULT_EQUIPPED];
      return value;
    }));
    expect(DEFAULT_EQUIPPED).toEqual({
      catSkin: 'cat-skin.default',
      board: 'board.wood',
      effect: 'effect.classic',
      buttonTheme: 'button-theme.classic',
    });
  });

  it('includes default cosmetics in every category with available previews', () => {
    const defaults = allCosmetics().filter((item) => item.price === 0);

    expect(defaults.map((item) => item.id)).toEqual([
      'cat-skin.default', 'board.wood', 'effect.classic', 'button-theme.classic',
    ]);
    expect(defaults.map((item) => item.previewAsset)).toEqual([
      'game/cats/cat_01/texture',
      'game/backgrounds/bg_board_wood/texture',
      'game/gameplay/merge_burst/texture',
      undefined,
    ]);
  });
});
