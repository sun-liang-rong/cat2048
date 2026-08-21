import { describe, expect, it, vi } from 'vitest';
import {
  CORRUPT_SAVE_KEY,
  DEFAULT_SAVE,
  LEGACY_SAVE_KEY,
  LocalGameStorage,
  SAVE_KEY,
} from '../assets/scripts/features/storage/storage';

class MemoryStorage {
  public values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

class ThrowingStorage {
  public constructor(private readonly failOn: 'get' | 'set') {}
  public getItem(): string | null {
    if (this.failOn === 'get') throw new Error('read failed');
    return null;
  }
  public setItem(): void {
    if (this.failOn === 'set') throw new Error('write failed');
  }
}

function withoutWarnings<T>(callback: () => T): T {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try { return callback(); } finally { console.warn = originalWarn; }
}

describe('LocalGameStorage', () => {
  it('repairs V1 data stored under the V2 key', () => {
    const memory = new MemoryStorage();
    memory.setItem(SAVE_KEY, JSON.stringify({
      schemaVersion: 1,
      highScore: 512,
      soundEnabled: false,
      hapticsEnabled: false,
    }));
    expect(new LocalGameStorage(memory).load()).toEqual(DEFAULT_SAVE);
  });

  it('migrates legacy V1 data from the legacy key', () => {
    const memory = new MemoryStorage();
    memory.setItem(LEGACY_SAVE_KEY, JSON.stringify({
      schemaVersion: 1,
      highScore: 256,
      soundEnabled: false,
    }));

    expect(new LocalGameStorage(memory).load()).toEqual({
      schemaVersion: 3,
      highScore: 256,
      soundEnabled: false,
      musicEnabled: true,
      hapticsEnabled: true,
      unlockedCatLevels: [1],
      tutorial: {
        swipeGuideCompleted: true,
        itemRefillGuideCompleted: false,
        collectionGuideCompleted: false,
      },
      economy: DEFAULT_SAVE.economy,
    });
  });

  it('migrates V2 data under the current key without losing progress', () => {
    const memory = new MemoryStorage();
    memory.setItem(SAVE_KEY, JSON.stringify({
      schemaVersion: 2,
      highScore: 1024,
      soundEnabled: false,
      hapticsEnabled: false,
      unlockedCatLevels: [1, 3, 5],
      tutorial: {
        swipeGuideCompleted: true,
        itemRefillGuideCompleted: true,
        collectionGuideCompleted: true,
      },
    }));

    expect(new LocalGameStorage(memory).load()).toEqual({
      schemaVersion: 3,
      highScore: 1024,
      soundEnabled: false,
      musicEnabled: true,
      hapticsEnabled: false,
      unlockedCatLevels: [1, 3, 5],
      tutorial: {
        swipeGuideCompleted: true,
        itemRefillGuideCompleted: true,
        collectionGuideCompleted: true,
      },
      economy: DEFAULT_SAVE.economy,
    });
  });

  it('repairs economy data with negative coins', () => {
    const memory = new MemoryStorage();
    memory.setItem(SAVE_KEY, JSON.stringify({
      ...DEFAULT_SAVE,
      economy: { ...DEFAULT_SAVE.economy, coins: -1 },
    }));

    withoutWarnings(() => expect(new LocalGameStorage(memory).load()).toEqual(DEFAULT_SAVE));
  });

  it('drops unknown cosmetic IDs and repairs invalid equipped cosmetics', () => {
    const memory = new MemoryStorage();
    memory.setItem(SAVE_KEY, JSON.stringify({
      ...DEFAULT_SAVE,
      economy: {
        ...DEFAULT_SAVE.economy,
        ownedItemIds: [...DEFAULT_SAVE.economy.ownedItemIds, 'board.missing'],
        equipped: {
          ...DEFAULT_SAVE.economy.equipped,
          board: 'board.missing',
        },
      },
    }));

    const loaded = new LocalGameStorage(memory).load();
    expect(loaded.economy.ownedItemIds).not.toContain('board.missing');
    expect(loaded.economy.equipped.board).toBe('board.wood');
  });

  it.each([null, '{bad', '{}', '{"schemaVersion":2}', '{"schemaVersion":1,"highScore":"9","soundEnabled":true}'])
    ('repairs missing or malformed data: %s', (raw) => {
      const memory = new MemoryStorage();
      if (raw !== null) memory.setItem(SAVE_KEY, raw);
      withoutWarnings(() => expect(new LocalGameStorage(memory).load()).toEqual(DEFAULT_SAVE));
      expect(JSON.parse(memory.getItem(SAVE_KEY)!)).toEqual(DEFAULT_SAVE);
    });

  it('backs up malformed persisted data before repairing it', () => {
    const memory = new MemoryStorage();
    const malformed = '{"schemaVersion":2,"highScore":"broken"}';
    memory.setItem(SAVE_KEY, malformed);

    withoutWarnings(() => new LocalGameStorage(memory).load());

    expect(memory.getItem(CORRUPT_SAVE_KEY)).toBe(malformed);
  });

  it('keeps gameplay usable when the storage backend throws', () => {
    expect(withoutWarnings(() => new LocalGameStorage(new ThrowingStorage('get')).load())).toEqual(DEFAULT_SAVE);
    expect(() => withoutWarnings(() => new LocalGameStorage(new ThrowingStorage('set')).save(DEFAULT_SAVE))).not.toThrow();
  });

  it('repairs malformed values passed at runtime instead of crashing', () => {
    const memory = new MemoryStorage();
    const storage = new LocalGameStorage(memory);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storage.save({ ...DEFAULT_SAVE, highScore: Number.NaN });
    expect(JSON.parse(memory.getItem(SAVE_KEY)!)).toEqual(DEFAULT_SAVE);
    expect(error).toHaveBeenCalledWith('[Cat2048] Malformed save data, repairing.');
    error.mockRestore();
  });
});
