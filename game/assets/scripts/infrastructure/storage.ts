export interface SaveDataV1 {
  readonly schemaVersion: 1;
  readonly highScore: number;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'cat2048.save.v1';
export const DEFAULT_SAVE: SaveDataV1 = {
  schemaVersion: 1,
  highScore: 0,
  soundEnabled: true,
  hapticsEnabled: true,
};

export class LocalGameStorage {
  public constructor(private readonly storage: KeyValueStorage) {}

  public load(): SaveDataV1 {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return this.repair();
      const value: unknown = JSON.parse(raw);
      const normalized = this.normalizeSaveData(value);
      if (!normalized) return this.repair();
      if (typeof (value as Record<string, unknown>).hapticsEnabled !== 'boolean') {
        try { this.storage.setItem(SAVE_KEY, JSON.stringify(normalized)); }
        catch (error) { console.warn('[Cat2048] Failed to migrate local data.', error); }
      }
      return normalized;
    } catch (error) {
      console.warn('[Cat2048] Save data was invalid and has been repaired.', error);
      return this.repair();
    }
  }

  public save(value: SaveDataV1): void {
    if (!this.isSaveData(value)) throw new Error('Refusing to persist malformed save data.');
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn('[Cat2048] Failed to save local data.', error);
    }
  }

  private repair(): SaveDataV1 {
    const safe = { ...DEFAULT_SAVE };
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(safe)); } catch { /* Gameplay must continue. */ }
    return safe;
  }

  private isSaveData(value: unknown): value is SaveDataV1 {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return candidate.schemaVersion === 1
      && typeof candidate.highScore === 'number'
      && Number.isInteger(candidate.highScore)
      && candidate.highScore >= 0
      && typeof candidate.soundEnabled === 'boolean'
      && typeof candidate.hapticsEnabled === 'boolean';
  }

  private normalizeSaveData(value: unknown): SaveDataV1 | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== 1
      || typeof candidate.highScore !== 'number'
      || !Number.isInteger(candidate.highScore)
      || candidate.highScore < 0
      || typeof candidate.soundEnabled !== 'boolean'
      || (candidate.hapticsEnabled !== undefined && typeof candidate.hapticsEnabled !== 'boolean')) return null;
    return {
      schemaVersion: 1,
      highScore: candidate.highScore,
      soundEnabled: candidate.soundEnabled,
      hapticsEnabled: candidate.hapticsEnabled ?? true,
    };
  }
}
