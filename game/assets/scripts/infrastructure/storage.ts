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

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'cat2048.save.v2';
export const LEGACY_SAVE_KEY = 'cat2048.save.v1';
export const DEFAULT_SAVE: SaveDataV2 = {
  schemaVersion: 2,
  highScore: 0,
  soundEnabled: true,
  hapticsEnabled: true,
  unlockedCatLevels: [1],
  tutorial: {
    swipeGuideCompleted: false,
    itemRefillGuideCompleted: false,
    collectionGuideCompleted: false,
  },
};

export class LocalGameStorage {
  public constructor(private readonly storage: KeyValueStorage) {}

  public load(): SaveDataV2 {
    try {
      const currentRaw = this.storage.getItem(SAVE_KEY);
      if (currentRaw) {
        const current = this.normalizeV2(JSON.parse(currentRaw) as unknown);
        return current ?? this.repair();
      }

      const legacyRaw = this.storage.getItem(LEGACY_SAVE_KEY);
      if (!legacyRaw) return this.repair();
      const migrated = this.migrateV1(JSON.parse(legacyRaw) as unknown);
      if (!migrated) return this.repair();
      this.persist(migrated, 'Failed to migrate local data.');
      return migrated;
    } catch (error) {
      console.warn('[Cat2048] Save data was invalid and has been repaired.', error);
      return this.repair();
    }
  }

  public save(value: SaveDataV2): void {
    const normalized = this.normalizeV2(value);
    if (!normalized) throw new Error('Refusing to persist malformed save data.');
    this.persist(normalized, 'Failed to save local data.');
  }

  private repair(): SaveDataV2 {
    const safe = this.freshDefault();
    this.persist(safe, 'Failed to repair local data.');
    return safe;
  }

  private persist(value: SaveDataV2, message: string): void {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn(`[Cat2048] ${message}`, error);
    }
  }

  private freshDefault(): SaveDataV2 {
    return {
      ...DEFAULT_SAVE,
      unlockedCatLevels: [...DEFAULT_SAVE.unlockedCatLevels],
      tutorial: { ...DEFAULT_SAVE.tutorial },
    };
  }

  private migrateV1(value: unknown): SaveDataV2 | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== 1
      || typeof candidate.highScore !== 'number'
      || !Number.isInteger(candidate.highScore)
      || candidate.highScore < 0
      || typeof candidate.soundEnabled !== 'boolean'
      || (candidate.hapticsEnabled !== undefined && typeof candidate.hapticsEnabled !== 'boolean')) return null;
    return {
      schemaVersion: 2,
      highScore: candidate.highScore,
      soundEnabled: candidate.soundEnabled,
      hapticsEnabled: candidate.hapticsEnabled ?? true,
      unlockedCatLevels: [1],
      tutorial: {
        swipeGuideCompleted: true,
        itemRefillGuideCompleted: false,
        collectionGuideCompleted: false,
      },
    };
  }

  private normalizeV2(value: unknown): SaveDataV2 | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    const tutorial = candidate.tutorial as Record<string, unknown> | undefined;
    const levels = candidate.unlockedCatLevels;
    if (candidate.schemaVersion !== 2
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
      || typeof tutorial.collectionGuideCompleted !== 'boolean') return null;
    return {
      schemaVersion: 2,
      highScore: candidate.highScore,
      soundEnabled: candidate.soundEnabled,
      hapticsEnabled: candidate.hapticsEnabled,
      unlockedCatLevels: [...new Set([1, ...(levels as number[])])].sort((a, b) => a - b),
      tutorial: {
        swipeGuideCompleted: tutorial.swipeGuideCompleted,
        itemRefillGuideCompleted: tutorial.itemRefillGuideCompleted,
        collectionGuideCompleted: tutorial.collectionGuideCompleted,
      },
    };
  }
}
