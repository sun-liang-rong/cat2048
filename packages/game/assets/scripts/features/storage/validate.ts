/**
 * 存档校验与版本迁移（纯函数，无存储副作用）。
 * 从 LocalGameStorage 拆出，便于独立测试。
 */
import {
  DEFAULT_ECONOMY,
  DEFAULT_EQUIPPED,
  findCosmetic,
  type CosmeticCategory,
  type EconomySaveData,
  type EquippedCosmetics,
} from '../economy/catalog';
import { GAME_CONFIG } from '../../core/config/gameConfig';
import type { SaveDataV3 } from './saveTypes';

/** 校验并归一化任意输入为 V3 存档；不合法返回 null。 */
export function normalizeSave(value: unknown): SaveDataV3 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion === 2) return migrateV2(candidate);
  const base = validateBase(candidate, 3);
  if (!base) return null;
  const economy = normalizeEconomy(candidate.economy);
  if (!economy) return null;
  return { ...base, schemaVersion: 3, economy };
}

/** 将 V1 旧存档迁移为 V3；不合法返回 null。 */
export function migrateV1Save(value: unknown): SaveDataV3 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1
    || typeof candidate.highScore !== 'number'
    || !Number.isInteger(candidate.highScore)
    || candidate.highScore < 0
    || typeof candidate.soundEnabled !== 'boolean'
    || (candidate.hapticsEnabled !== undefined && typeof candidate.hapticsEnabled !== 'boolean')) return null;
  return {
    schemaVersion: 3,
    highScore: candidate.highScore,
    soundEnabled: candidate.soundEnabled,
    musicEnabled: true,
    hapticsEnabled: candidate.hapticsEnabled ?? true,
    unlockedCatLevels: [1],
    tutorial: {
      swipeGuideCompleted: true,
      itemRefillGuideCompleted: false,
      collectionGuideCompleted: false,
    },
    economy: defaultEconomy(),
  };
}

function migrateV2(candidate: Record<string, unknown>): SaveDataV3 | null {
  const base = validateBase(candidate, 2);
  if (!base) return null;
  return { ...base, schemaVersion: 3, economy: defaultEconomy() };
}

function validateBase(candidate: Record<string, unknown>, version: 2 | 3): Omit<SaveDataV3, 'schemaVersion' | 'economy'> | null {
  const tutorial = candidate.tutorial as Record<string, unknown> | undefined;
  const levels = candidate.unlockedCatLevels;
  if (candidate.schemaVersion !== version
    || typeof candidate.highScore !== 'number'
    || !Number.isInteger(candidate.highScore)
    || candidate.highScore < 0
    || typeof candidate.soundEnabled !== 'boolean'
    || typeof candidate.hapticsEnabled !== 'boolean'
    || !Array.isArray(levels)
    || levels.length === 0
    || !levels.every((level) => Number.isInteger(level) && level >= 1 && level <= GAME_CONFIG.cats.length)
    || !tutorial
    || typeof tutorial.swipeGuideCompleted !== 'boolean'
    || typeof tutorial.itemRefillGuideCompleted !== 'boolean'
    || (version === 2 && typeof tutorial.collectionGuideCompleted !== 'boolean')) return null;
  return {
    highScore: candidate.highScore,
    soundEnabled: candidate.soundEnabled,
    musicEnabled: typeof candidate.musicEnabled === 'boolean' ? candidate.musicEnabled : true,
    hapticsEnabled: candidate.hapticsEnabled,
    unlockedCatLevels: Array.from(new Set([1, ...(levels as number[])])).sort((a, b) => a - b),
    tutorial: {
      swipeGuideCompleted: tutorial.swipeGuideCompleted,
      itemRefillGuideCompleted: tutorial.itemRefillGuideCompleted,
      collectionGuideCompleted: typeof tutorial.collectionGuideCompleted === 'boolean'
        ? tutorial.collectionGuideCompleted : false,
    },
  };
}

function normalizeEconomy(value: unknown): EconomySaveData | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const equipped = candidate.equipped as Record<string, unknown> | undefined;
  const owned = candidate.ownedItemIds;
  const settled = candidate.settledRunIds;
  if (typeof candidate.coins !== 'number' || !Number.isSafeInteger(candidate.coins) || candidate.coins < 0
    || !Array.isArray(owned) || !owned.every((id) => typeof id === 'string')
    || !equipped || typeof equipped.catSkin !== 'string' || typeof equipped.board !== 'string'
    || typeof equipped.effect !== 'string'
    || (candidate.lastDailyClaimDate !== null && typeof candidate.lastDailyClaimDate !== 'string')
    || typeof candidate.dailyStreak !== 'number' || !Number.isSafeInteger(candidate.dailyStreak)
    || candidate.dailyStreak < 0 || !Array.isArray(settled) || !settled.every((id) => typeof id === 'string')) return null;
  const ownedItemIds = Array.from(new Set([...(DEFAULT_ECONOMY.ownedItemIds), ...(owned as string[])]))
    .filter((id) => Boolean(findCosmetic(id)));
  return {
    coins: candidate.coins,
    ownedItemIds,
    equipped: {
      catSkin: validEquipped(equipped.catSkin, 'cat-skin', ownedItemIds, DEFAULT_EQUIPPED.catSkin),
      board: validEquipped(equipped.board, 'board', ownedItemIds, DEFAULT_EQUIPPED.board),
      effect: validEquipped(equipped.effect, 'effect', ownedItemIds, DEFAULT_EQUIPPED.effect),
    },
    lastDailyClaimDate: candidate.lastDailyClaimDate as string | null,
    dailyStreak: candidate.dailyStreak,
    settledRunIds: Array.from(new Set(settled as string[])),
    undoItems: normalizeItemCount(candidate.undoItems),
    spawnItems: normalizeItemCount(candidate.spawnItems),
    shuffleItems: normalizeItemCount(candidate.shuffleItems),
    eraseItems: normalizeItemCount(candidate.eraseItems),
    dailyAdUndo: normalizeItemCount(candidate.dailyAdUndo),
    dailyAdSpawn: normalizeItemCount(candidate.dailyAdSpawn),
    dailyAdShuffle: normalizeItemCount(candidate.dailyAdShuffle),
    dailyAdErase: normalizeItemCount(candidate.dailyAdErase),
    dailyLoginClaimed: typeof candidate.dailyLoginClaimed === 'boolean' ? candidate.dailyLoginClaimed : false,
    dailyShareUndo: normalizeItemCount(candidate.dailyShareUndo),
  };
}

function defaultEconomy(): EconomySaveData {
  return {
    ...DEFAULT_ECONOMY,
    ownedItemIds: [...DEFAULT_ECONOMY.ownedItemIds],
    equipped: { ...DEFAULT_ECONOMY.equipped },
    settledRunIds: [],
  };
}

function normalizeItemCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function validEquipped(value: unknown, category: CosmeticCategory, owned: readonly string[], fallback: string): string {
  if (typeof value !== 'string' || owned.indexOf(value) < 0) return fallback;
  return findCosmetic(value)?.category === category ? value : fallback;
}
