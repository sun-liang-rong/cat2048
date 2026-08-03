export interface TutorialProgress {
  readonly swipeGuideCompleted: boolean;
  readonly itemRefillGuideCompleted: boolean;
  readonly collectionGuideCompleted: boolean;
}

export interface SaveDataV1 {
  readonly schemaVersion: 1;
  readonly highScore: number;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled?: boolean;
}

export interface SaveDataV2 {
  readonly schemaVersion: 2;
  readonly highScore: number;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly unlockedCatLevels: readonly number[];
  readonly tutorial: TutorialProgress;
}

import {
  DEFAULT_ECONOMY,
  DEFAULT_EQUIPPED,
  findCosmetic,
  type CosmeticCategory,
  type EconomySaveData,
  type EquippedCosmetics,
} from '../economy/catalog';

export interface SaveDataV3 {
  readonly schemaVersion: 3;
  readonly highScore: number;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly unlockedCatLevels: readonly number[];
  readonly tutorial: TutorialProgress;
  readonly economy: EconomySaveData;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'cat2048.save.v2';
export const LEGACY_SAVE_KEY = 'cat2048.save.v1';
export const CORRUPT_SAVE_KEY = 'cat2048.save.corrupt';
export const DEFAULT_SAVE: SaveDataV3 = {
  schemaVersion: 3,
  highScore: 0,
  soundEnabled: true,
  hapticsEnabled: true,
  unlockedCatLevels: [1],
  tutorial: {
    swipeGuideCompleted: false,
    itemRefillGuideCompleted: false,
    collectionGuideCompleted: false,
  },
  economy: DEFAULT_ECONOMY,
} as SaveDataV3;

export class LocalGameStorage {
  public constructor(private readonly storage: KeyValueStorage) {}

  public load(): SaveDataV3 {
    let rawToBackup: string | null = null;
    try {
      const currentRaw = this.storage.getItem(SAVE_KEY);
      if (currentRaw) {
        rawToBackup = currentRaw;
        const current = this.normalize(JSON.parse(currentRaw) as unknown);
        return current ?? this.repair(rawToBackup);
      }

      const legacyRaw = this.storage.getItem(LEGACY_SAVE_KEY);
      if (!legacyRaw) return this.repair();
      rawToBackup = legacyRaw;
      const migrated = this.migrateV1(JSON.parse(legacyRaw) as unknown);
      if (!migrated) return this.repair(rawToBackup);
      this.persist(migrated, 'Failed to migrate local data.');
      return migrated;
    } catch (error) {
      if (rawToBackup) this.backupCorrupt(rawToBackup);
      console.warn('[Cat2048] Save data was invalid and has been repaired.', error);
      return this.repair();
    }
  }

  public save(value: SaveDataV3): void {
    const normalized = this.normalize(value);
    if (!normalized) {
      console.error('[Cat2048] Malformed save data, repairing.');
      const repaired = this.freshDefault();
      this.persist(repaired, 'Failed to save local data.');
      return;
    }
    this.persist(normalized, 'Failed to save local data.');
  }

  private repair(raw?: string): SaveDataV3 {
    if (raw) this.backupCorrupt(raw);
    const safe = this.freshDefault();
    this.persist(safe, 'Failed to repair local data.');
    return safe;
  }

  private backupCorrupt(raw: string): void {
    try {
      if (this.storage.getItem(CORRUPT_SAVE_KEY) === null) {
        this.storage.setItem(CORRUPT_SAVE_KEY, raw);
      }
    } catch (error) {
      console.warn('[Cat2048] Failed to back up corrupt local data.', error);
    }
  }

  private persist(value: SaveDataV3, message: string): void {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn(`[Cat2048] ${message}`, error);
    }
  }

  private freshDefault(): SaveDataV3 {
    return {
      ...DEFAULT_SAVE,
      unlockedCatLevels: [...DEFAULT_SAVE.unlockedCatLevels],
      tutorial: { ...DEFAULT_SAVE.tutorial },
    };
  }

  private migrateV1(value: unknown): SaveDataV3 | null {
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
      hapticsEnabled: candidate.hapticsEnabled ?? true,
      unlockedCatLevels: [1],
      tutorial: {
        swipeGuideCompleted: true,
        itemRefillGuideCompleted: false,
        collectionGuideCompleted: false,
      },
      economy: this.defaultEconomy(),
    };
  }

  private migrateV2(value: Record<string, unknown>): SaveDataV3 | null {
    const base = this.validateBase(value, 2);
    if (!base) return null;
    return { ...base, schemaVersion: 3, economy: this.defaultEconomy() };
  }

  private normalize(value: unknown): SaveDataV3 | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion === 2) return this.migrateV2(candidate);
    const base = this.validateBase(candidate, 3);
    if (!base) return null;
    const economy = this.normalizeEconomy(candidate.economy);
    if (!economy) return null;
    return { ...base, schemaVersion: 3, economy };
  }

  private validateBase(candidate: Record<string, unknown>, version: 2 | 3): Omit<SaveDataV3, 'schemaVersion' | 'economy'> | null {
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
      || !levels.every((level) => Number.isInteger(level) && level >= 1 && level <= 9)
      || !tutorial
      || typeof tutorial.swipeGuideCompleted !== 'boolean'
      || typeof tutorial.itemRefillGuideCompleted !== 'boolean'
      || (version === 2 && typeof tutorial.collectionGuideCompleted !== 'boolean')) return null;
    return {
      highScore: candidate.highScore,
      soundEnabled: candidate.soundEnabled,
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

  private normalizeEconomy(value: unknown): EconomySaveData | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    const equipped = candidate.equipped as Record<string, unknown> | undefined;
    const owned = candidate.ownedItemIds;
    const settled = candidate.settledRunIds;
    if (typeof candidate.coins !== 'number' || !Number.isSafeInteger(candidate.coins) || candidate.coins < 0
      || !Array.isArray(owned) || !owned.every((id) => typeof id === 'string')
      || !equipped || typeof equipped.catSkin !== 'string' || typeof equipped.board !== 'string'
      || typeof equipped.effect !== 'string' || typeof equipped.buttonTheme !== 'string'
      || (candidate.lastDailyClaimDate !== null && typeof candidate.lastDailyClaimDate !== 'string')
      || typeof candidate.dailyStreak !== 'number' || !Number.isSafeInteger(candidate.dailyStreak)
      || candidate.dailyStreak < 0 || !Array.isArray(settled) || !settled.every((id) => typeof id === 'string')) return null;
    const ownedItemIds = Array.from(new Set([...(DEFAULT_ECONOMY.ownedItemIds), ...(owned as string[])]))
      .filter((id) => Boolean(findCosmetic(id)));
    return {
      coins: candidate.coins,
      ownedItemIds,
      equipped: {
        catSkin: this.validEquipped(equipped.catSkin, 'cat-skin', ownedItemIds, DEFAULT_EQUIPPED.catSkin),
        board: this.validEquipped(equipped.board, 'board', ownedItemIds, DEFAULT_EQUIPPED.board),
        effect: this.validEquipped(equipped.effect, 'effect', ownedItemIds, DEFAULT_EQUIPPED.effect),
        buttonTheme: this.validEquipped(equipped.buttonTheme, 'button-theme', ownedItemIds,
          DEFAULT_EQUIPPED.buttonTheme),
      },
      lastDailyClaimDate: candidate.lastDailyClaimDate as string | null,
      dailyStreak: candidate.dailyStreak,
      settledRunIds: Array.from(new Set(settled as string[])),
    };
  }

  private defaultEconomy(): EconomySaveData {
    return {
      ...DEFAULT_ECONOMY,
      ownedItemIds: [...DEFAULT_ECONOMY.ownedItemIds],
      equipped: { ...DEFAULT_ECONOMY.equipped },
      settledRunIds: [],
    };
  }

  private validEquipped(value: unknown, category: CosmeticCategory, owned: readonly string[], fallback: string): string {
    if (typeof value !== 'string' || owned.indexOf(value) < 0) return fallback;
    return findCosmetic(value)?.category === category ? value : fallback;
  }
}
