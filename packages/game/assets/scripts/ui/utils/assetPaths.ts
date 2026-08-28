/**
 * 资源路径收集（从 Cat2048Boot 拆出）。
 */
import type { CosmeticCategory, CosmeticDefinition } from '../../features/economy/catalog';
import { GAME_CONFIG } from '../../core/config/gameConfig';

/** 商店卡片只需要商品预览图；等级立绘在装备或进入图鉴后再按需加载。 */
export function shopPreviewAssetPaths(
  catalog: readonly CosmeticDefinition[],
  category: CosmeticCategory,
): string[] {
  const paths = new Set<string>();
  for (const item of catalog) {
    if (item.category !== category) continue;
    if (item.previewAsset) paths.add(item.previewAsset);
  }
  return Array.from(paths);
}

/** 装备后立即进入对局所需的最小资源集。 */
export function equippedCosmeticAssetPaths(
  catalog: readonly CosmeticDefinition[],
  itemId: string,
): string[] {
  const item = catalog.find((candidate) => candidate.id === itemId);
  if (!item) return [];
  if (item.category === 'cat-skin') return Array.from(new Set(item.levelAssets?.slice(0, 4) ?? []));
  if (item.category === 'board') return item.boardAsset ? [item.boardAsset] : [];
  return Array.from(new Set([item.sparkleAsset, item.burstAsset]
    .filter((path): path is string => path !== undefined)));
}

export interface CollectionCatAsset {
  readonly level: number;
  readonly path: string;
}

/** 当前装备皮肤在图鉴中已解锁的立绘，按等级从低到高返回。 */
export function collectionCatAssets(
  catalog: readonly CosmeticDefinition[],
  skinId: string,
  unlockedLevels: readonly number[],
): CollectionCatAsset[] {
  const skin = catalog.find((item) => item.id === skinId && item.category === 'cat-skin');
  const unlocked = new Set(unlockedLevels);
  return GAME_CONFIG.cats
    .filter((cat) => unlocked.has(cat.level))
    .map((cat) => ({
      level: cat.level,
      path: skin?.levelAssets?.[cat.level - 1] ?? cat.asset,
    }));
}

/** 图鉴页所需的资源路径。 */
export function collectionAssetPaths(): string[] {
  const art = GAME_CONFIG.art;
  return [
    art.collectionBackground,
    art.collectionCardLight,
    art.collectionCardLocked,
    art.collectionBackPaw,
    art.collectionLockedCat,
    art.collectionLock,
  ];
}
