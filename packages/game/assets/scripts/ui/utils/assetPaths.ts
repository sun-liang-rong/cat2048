/**
 * 资源路径收集（从 Cat2048Boot 拆出）。
 */
import type { CosmeticDefinition } from '../../features/economy/catalog';
import { GAME_CONFIG } from '../../core/config/gameConfig';

/** 收集商店目录中所有商品引用的资源路径。 */
export function cosmeticAssetPaths(catalog: readonly CosmeticDefinition[]): string[] {
  const paths = new Set<string>();
  for (const item of catalog) {
    if (item.previewAsset) paths.add(item.previewAsset);
    if (item.levelAssets) for (const path of item.levelAssets) paths.add(path);
    if (item.boardAsset) paths.add(item.boardAsset);
    if (item.sparkleAsset) paths.add(item.sparkleAsset);
    if (item.burstAsset) paths.add(item.burstAsset);
  }
  return Array.from(paths);
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
