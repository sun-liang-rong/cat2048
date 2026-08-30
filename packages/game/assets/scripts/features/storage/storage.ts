/**
 * 本地存档存取（模块入口）。
 *
 * 公开 API 统一从这里 re-export，保持导入面稳定：
 * - 类型定义：./saveTypes
 * - 校验/迁移纯函数：./validate
 */
import {
  DEFAULT_ECONOMY,
  type EconomySaveData,
} from '../economy/catalog';
import { normalizeSave, migrateV1Save } from './validate';
import type { KeyValueStorage, SaveDataV3 } from './saveTypes';

export * from './saveTypes';
export * from './validate';

export const SAVE_KEY = 'cat2048.save.v2';
export const LEGACY_SAVE_KEY = 'cat2048.save.v1';
export const CORRUPT_SAVE_KEY = 'cat2048.save.corrupt';
export const DEFAULT_SAVE: SaveDataV3 = {
  schemaVersion: 3,
  highScore: 0,
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  unlockedCatLevels: [1],
  tutorial: {
    swipeGuideCompleted: false,
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
        const current = normalizeSave(JSON.parse(currentRaw) as unknown);
        return current ?? this.repair(rawToBackup);
      }

      const legacyRaw = this.storage.getItem(LEGACY_SAVE_KEY);
      if (!legacyRaw) return this.repair();
      rawToBackup = legacyRaw;
      const migrated = migrateV1Save(JSON.parse(legacyRaw) as unknown);
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
    const normalized = normalizeSave(value);
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
}
