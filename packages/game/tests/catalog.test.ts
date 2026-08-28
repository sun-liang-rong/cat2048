import { describe, expect, it } from 'vitest';
import {
  allCosmetics,
  DEFAULT_ECONOMY,
  DEFAULT_EQUIPPED,
  SHOP_ITEMS,
} from '../assets/scripts/features/economy/catalog';
import {
  collectionCatAssets,
  equippedCosmeticAssetPaths,
  shopPreviewAssetPaths,
} from '../assets/scripts/ui/utils/assetPaths';

describe('cosmetic catalog', () => {
  it('contains the three planned cosmetic categories and stable prices', () => {
    expect(SHOP_ITEMS.map((item) => item.category)).toEqual([
      'cat-skin', 'cat-skin', 'cat-skin', 'cat-skin', 'cat-skin',
      'board', 'board', 'effect', 'effect',
    ]);
    expect(SHOP_ITEMS.map((item) => item.price)).toEqual([
      800, 900, 1000, 1500, 1800, 250, 500, 300, 600,
    ]);
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
    });
  });

  it('includes default cosmetics in every category with available previews', () => {
    const defaults = allCosmetics().filter((item) => item.price === 0);

    expect(defaults.map((item) => item.id)).toEqual([
      'cat-skin.default', 'board.wood', 'effect.classic',
    ]);
    expect(defaults.map((item) => item.previewAsset)).toEqual([
      'game/cats/classic/cat_01/texture',
      'game/backgrounds/board/wood/bg_board_wood/texture',
      'game/effects/classic/merge_burst/texture',
    ]);
  });

  it('exposes twelve levels for every cat skin family', () => {
    const catSkins = allCosmetics().filter((item) => item.category === 'cat-skin');

    expect(catSkins).toHaveLength(6);
    expect(catSkins.every((item) => item.levelAssets?.length === 12)).toBe(true);
  });

  it('loads only card previews for the selected shop category', () => {
    const paths = shopPreviewAssetPaths(allCosmetics(), 'cat-skin');
    const skinCount = allCosmetics().filter((item) => item.category === 'cat-skin').length;

    expect(paths).toHaveLength(skinCount);
    expect(paths.every((path) => path.endsWith('/cat_01/texture'))).toBe(true);
    expect(paths.some((path) => path.includes('/cat_02/'))).toBe(false);
  });

  it('loads only unlocked collection cats from the equipped skin', () => {
    expect(collectionCatAssets(allCosmetics(), 'cat-skin.dream', [8, 2, 2, 99])).toEqual([
      { level: 2, path: 'game/cats/dream/cat_02/texture' },
      { level: 8, path: 'game/cats/dream/cat_08/texture' },
    ]);
  });

  it('warms only the minimum runtime assets after equipping', () => {
    expect(equippedCosmeticAssetPaths(allCosmetics(), 'cat-skin.ocean')).toEqual([
      'game/cats/ocean/cat_01/texture',
      'game/cats/ocean/cat_02/texture',
      'game/cats/ocean/cat_03/texture',
      'game/cats/ocean/cat_04/texture',
    ]);
    expect(equippedCosmeticAssetPaths(allCosmetics(), 'effect.stars')).toEqual([
      'game/effects/stars/stars_sparkle/texture',
      'game/effects/stars/stars_burst/texture',
    ]);
  });
});
