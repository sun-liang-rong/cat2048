export type CosmeticCategory = 'cat-skin' | 'board' | 'effect' | 'button-theme';

export interface EquippedCosmetics {
  readonly catSkin: string;
  readonly board: string;
  readonly effect: string;
  readonly buttonTheme: string;
}

export interface CosmeticDefinition {
  readonly id: string;
  readonly category: CosmeticCategory;
  readonly name: string;
  readonly price: number;
  readonly previewAsset?: string;
  readonly levelAssets?: readonly string[];
  readonly boardAsset?: string;
  readonly sparkleAsset?: string;
  readonly burstAsset?: string;
  readonly primaryAsset?: string;
  readonly secondaryAsset?: string;
  readonly rewardAsset?: string;
  readonly creamAsset?: string;
}

export interface EconomySaveData {
  readonly coins: number;
  readonly ownedItemIds: readonly string[];
  readonly equipped: EquippedCosmetics;
  readonly lastDailyClaimDate: string | null;
  readonly dailyStreak: number;
  readonly settledRunIds: readonly string[];
}

export const DEFAULT_EQUIPPED: EquippedCosmetics = {
  catSkin: 'cat-skin.default',
  board: 'board.wood',
  effect: 'effect.classic',
  buttonTheme: 'button-theme.classic',
};

const defaultCatAssets: readonly string[] = Array.from({ length: 12 }, (_, index) =>
  `game/cats/cat_${index + 1 < 10 ? '0' : ''}${index + 1}/texture`);

const DEFAULT_ITEM_DEFINITIONS: readonly CosmeticDefinition[] = [
  {
    id: 'cat-skin.default',
    category: 'cat-skin',
    name: '\u7ecf\u5178\u732b\u54aa',
    price: 0,
    previewAsset: defaultCatAssets[0],
    levelAssets: defaultCatAssets,
  },
  {
    id: 'board.wood',
    category: 'board',
    name: '\u6728\u8d28\u732b\u7a9d',
    price: 0,
    previewAsset: 'game/backgrounds/bg_board_wood/texture',
    boardAsset: 'game/backgrounds/bg_board_wood/texture',
  },
  {
    id: 'effect.classic',
    category: 'effect',
    name: '\u7ecf\u5178\u5408\u6210',
    price: 0,
    previewAsset: 'game/gameplay/merge_burst/texture',
    sparkleAsset: 'game/gameplay/merge_sparkle/texture',
    burstAsset: 'game/gameplay/merge_burst/texture',
  },
  {
    id: 'button-theme.classic',
    category: 'button-theme',
    name: '\u7ecf\u5178\u4e3b\u9898',
    price: 0,
  },
];

export const DEFAULT_ECONOMY: EconomySaveData = {
  coins: 100,
  ownedItemIds: DEFAULT_ITEM_DEFINITIONS.map((item) => item.id),
  equipped: DEFAULT_EQUIPPED,
  lastDailyClaimDate: null,
  dailyStreak: 0,
  settledRunIds: [],
};

const skinAssets = (skin: string): readonly string[] => Array.from({ length: 9 }, (_, index) =>
  `game/cosmetics/cat-skins/${skin}/cat_${index + 1 < 10 ? '0' : ''}${index + 1}/texture`);

export const SHOP_ITEMS: readonly CosmeticDefinition[] = [
  {
    id: 'cat-skin.sunny',
    category: 'cat-skin',
    name: '\u9633\u5149\u732b\u54aa',
    price: 800,
    previewAsset: skinAssets('sunny')[0],
    levelAssets: skinAssets('sunny'),
  },
  {
    id: 'cat-skin.aurora',
    category: 'cat-skin',
    name: '\u6781\u5149\u732b\u54aa',
    price: 1200,
    previewAsset: skinAssets('aurora')[0],
    levelAssets: skinAssets('aurora'),
  },
  {
    id: 'board.pink',
    category: 'board',
    name: '\u7c89\u8272\u732b\u7a9d',
    price: 250,
    previewAsset: 'game/backgrounds/bg_board_pink/texture',
    boardAsset: 'game/backgrounds/bg_board_pink/texture',
  },
  {
    id: 'board.star',
    category: 'board',
    name: '\u661f\u7a7a\u732b\u7a9d',
    price: 500,
    previewAsset: 'game/backgrounds/bg_board_star/texture',
    boardAsset: 'game/backgrounds/bg_board_star/texture',
  },
  {
    id: 'effect.aurora',
    category: 'effect',
    name: '\u6781\u5149\u5408\u6210',
    price: 300,
    previewAsset: 'game/gameplay/effects/aurora_burst/texture',
    sparkleAsset: 'game/gameplay/effects/aurora_sparkle/texture',
    burstAsset: 'game/gameplay/effects/aurora_burst/texture',
  },
  {
    id: 'effect.stars',
    category: 'effect',
    name: '\u661f\u5c51\u5408\u6210',
    price: 600,
    previewAsset: 'game/gameplay/effects/stars_burst/texture',
    sparkleAsset: 'game/gameplay/effects/stars_sparkle/texture',
    burstAsset: 'game/gameplay/effects/stars_burst/texture',
  },
  {
    id: 'button-theme.berry',
    category: 'button-theme',
    name: '\u6811\u8393\u4e3b\u9898',
    price: 180,
    previewAsset: 'game/ui/button-themes/berry/primary/texture',
    primaryAsset: 'game/ui/button-themes/berry/primary/texture',
    secondaryAsset: 'game/ui/button-themes/berry/secondary/texture',
    rewardAsset: 'game/ui/button-themes/berry/reward/texture',
    creamAsset: 'game/ui/button-themes/berry/cream/texture',
  },
  {
    id: 'button-theme.aurora',
    category: 'button-theme',
    name: '\u6781\u5149\u4e3b\u9898',
    price: 360,
    previewAsset: 'game/ui/button-themes/aurora/primary/texture',
    primaryAsset: 'game/ui/button-themes/aurora/primary/texture',
    secondaryAsset: 'game/ui/button-themes/aurora/secondary/texture',
    rewardAsset: 'game/ui/button-themes/aurora/reward/texture',
    creamAsset: 'game/ui/button-themes/aurora/cream/texture',
  },
];

export const allCosmetics = (): readonly CosmeticDefinition[] => [
  ...DEFAULT_ITEM_DEFINITIONS,
  ...SHOP_ITEMS,
];

export function findCosmetic(id: string): CosmeticDefinition | undefined {
  return allCosmetics().find((item) => item.id === id);
}
