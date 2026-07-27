import { describe, expect, it } from 'vitest';
import { DEFAULT_SAVE, LocalGameStorage, SAVE_KEY } from '../assets/scripts/infrastructure/storage';

class MemoryStorage {
  public values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('LocalGameStorage', () => {
  it('loads valid V1 data', () => {
    const memory = new MemoryStorage();
    memory.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 1, highScore: 512, soundEnabled: false }));
    expect(new LocalGameStorage(memory).load()).toEqual({ schemaVersion: 1, highScore: 512, soundEnabled: false });
  });

  it.each([null, '{bad', '{}', '{"schemaVersion":2}', '{"schemaVersion":1,"highScore":"9","soundEnabled":true}'])
    ('repairs missing or malformed data: %s', (raw) => {
      const memory = new MemoryStorage();
      if (raw !== null) memory.setItem(SAVE_KEY, raw);
      const originalWarn = console.warn;
      console.warn = () => undefined;
      try {
        expect(new LocalGameStorage(memory).load()).toEqual(DEFAULT_SAVE);
      } finally {
        console.warn = originalWarn;
      }
      expect(JSON.parse(memory.getItem(SAVE_KEY)!)).toEqual(DEFAULT_SAVE);
    });
});
