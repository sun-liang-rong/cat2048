import { describe, expect, it } from 'vitest';
import { DEFAULT_SAVE, LocalGameStorage, SAVE_KEY } from '../assets/scripts/infrastructure/storage';

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
  it('loads complete V1 data', () => {
    const memory = new MemoryStorage();
    memory.setItem(SAVE_KEY, JSON.stringify({
      schemaVersion: 1,
      highScore: 512,
      soundEnabled: false,
      hapticsEnabled: false,
    }));
    expect(new LocalGameStorage(memory).load()).toEqual({
      schemaVersion: 1,
      highScore: 512,
      soundEnabled: false,
      hapticsEnabled: false,
    });
  });

  it('enables haptics while preserving legacy V1 save values', () => {
    const memory = new MemoryStorage();
    memory.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 1, highScore: 256, soundEnabled: false }));

    expect(new LocalGameStorage(memory).load()).toEqual({
      schemaVersion: 1,
      highScore: 256,
      soundEnabled: false,
      hapticsEnabled: true,
    });
    expect(JSON.parse(memory.getItem(SAVE_KEY)!)).toEqual({
      schemaVersion: 1,
      highScore: 256,
      soundEnabled: false,
      hapticsEnabled: true,
    });
  });

  it.each([null, '{bad', '{}', '{"schemaVersion":2}', '{"schemaVersion":1,"highScore":"9","soundEnabled":true}'])
    ('repairs missing or malformed data: %s', (raw) => {
      const memory = new MemoryStorage();
      if (raw !== null) memory.setItem(SAVE_KEY, raw);
      withoutWarnings(() => expect(new LocalGameStorage(memory).load()).toEqual(DEFAULT_SAVE));
      expect(JSON.parse(memory.getItem(SAVE_KEY)!)).toEqual(DEFAULT_SAVE);
    });

  it('keeps gameplay usable when the storage backend throws', () => {
    expect(withoutWarnings(() => new LocalGameStorage(new ThrowingStorage('get')).load())).toEqual(DEFAULT_SAVE);
    expect(() => withoutWarnings(() => new LocalGameStorage(new ThrowingStorage('set')).save(DEFAULT_SAVE))).not.toThrow();
  });

  it('refuses malformed values passed at runtime', () => {
    const storage = new LocalGameStorage(new MemoryStorage());
    expect(() => storage.save({ ...DEFAULT_SAVE, highScore: Number.NaN })).toThrow('malformed save data');
  });
});
