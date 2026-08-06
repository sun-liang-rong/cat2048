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
  `game/cats/classic/cat_${index + 1 < 10 ? '0' : ''}${index + 1}/texture`);

const DEFAULT_ITEM_DEFINITIONS: readonly CosmeticDefinition[] = [
  {
    id: 'cat-skin.default',
    category: 'cat-skin',
    name: '经典猫咪',
    price: 0,
    previewAsset: defaultCatAssets[0],
    levelAssets: defaultCatAssets,
  },
  {
    id: 'board.wood',
    category: 'board',
    name: '木质猫窝',
    price: 0,
    previewAsset: 'game/backgrounds/board/wood/bg_board_wood/texture',
    boardAsset: 'game/backgrounds/board/wood/bg_board_wood/texture',
  },
  {
    id: 'effect.classic',
    category: 'effect',
    name: '经典合成',
    price: 0,
    previewAsset: 'game/effects/classic/merge_burst/texture',
    sparkleAsset: 'game/effects/classic/merge_sparkle/texture',
    burstAsset: 'game/effects/classic/merge_burst/texture',
  },
  {
    id: 'button-theme.classic',
    category: 'button-theme',
    name: '经典主题',
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

const skinAssets = (skin: string): readonly string[] => Array.from({ length: 12 }, (_, index) =>
  `game/cats/${skin}/cat_${index + 1 < 10 ? '0' : ''}${index + 1}/texture`);

export const SHOP_ITEMS: readonly CosmeticDefinition[] = [
  {
    id: 'cat-skin.sunny',
    category: 'cat-skin',
    name: '阳光猫咪',
    price: 800,
    previewAsset: skinAssets('sunny')[0],
    levelAssets: skinAssets('sunny'),
  },
  {
    id: 'cat-skin.aurora',
    category: 'cat-skin',
    name: '极光猫咪',
    price: 1200,
    previewAsset: skinAssets('aurora')[0],
    levelAssets: skinAssets('aurora'),
  },
  {
    id: 'board.pink',
    category: 'board',
    name: '粉色猫窝',
    price: 250,
    previewAsset: 'game/backgrounds/board/pink/bg_board_pink/texture',
    boardAsset: 'game/backgrounds/board/pink/bg_board_pink/texture',
  },
  {
    id: 'board.star',
    category: 'board',
    name: '星空猫窝',
    price: 500,
    previewAsset: 'game/backgrounds/board/star/bg_board_star/texture',
    boardAsset: 'game/backgrounds/board/star/bg_board_star/texture',
  },
  {
    id: 'effect.aurora',
    category: 'effect',
    name: '极光合成',
    price: 300,
    previewAsset: 'game/effects/aurora/aurora_burst/texture',
    sparkleAsset: 'game/effects/aurora/aurora_sparkle/texture',
    burstAsset: 'game/effects/aurora/aurora_burst/texture',
  },
  {
    id: 'effect.stars',
    category: 'effect',
    name: '星屑合成',
    price: 600,
    previewAsset: 'game/effects/stars/stars_burst/texture',
    sparkleAsset: 'game/effects/stars/stars_sparkle/texture',
    burstAsset: 'game/effects/stars/stars_burst/texture',
  },
  {
    id: 'button-theme.berry',
    category: 'button-theme',
    name: '树莓主题',
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
    name: '极光主题',
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
