import { describe, expect, it } from 'vitest';
import {
  RUN_SESSION_SAVE_KEY,
  RunSessionStore,
  normalizeSavedRun,
  type SavedRun,
} from '../assets/scripts/features/storage/runSession';
import type { KeyValueStorage } from '../assets/scripts/features/storage/storage';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

const sampleRun = (): SavedRun => ({
  runId: 'run-123',
  board: { size: 4, tiles: [{ id: 'tile-1', level: 2, row: 0, col: 0 }] },
  score: 42,
  nextTileId: 3,
  usedItemKinds: ['undo'],
  reviveRemaining: 1,
  savedAt: 1_700_000_000_000,
  mode: 'classic',
  dailyChallengeCompleted: false,
  moves: 12,
  merges: 7,
});

describe('RunSessionStore', () => {
  it('saves and loads a run session', () => {
    const storage = new MemoryStorage();
    const store = new RunSessionStore(storage);
    store.save(sampleRun());
    expect(store.load()).toEqual(sampleRun());
  });

  it('returns null when nothing is saved', () => {
    const store = new RunSessionStore(new MemoryStorage());
    expect(store.load()).toBeNull();
  });

  it('clears a saved session', () => {
    const storage = new MemoryStorage();
    const store = new RunSessionStore(storage);
    store.save(sampleRun());
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('ignores corrupt data and returns null', () => {
    const storage = new MemoryStorage();
    storage.setItem(RUN_SESSION_SAVE_KEY, '{broken');
    const store = new RunSessionStore(storage);
    expect(store.load()).toBeNull();
  });
});

describe('normalizeSavedRun', () => {
  it('clamps revive usage and validates item kinds', () => {
    const normalized = normalizeSavedRun({
      ...sampleRun(),
      usedItemKinds: ['undo', 'invalid', 'spawn'],
      reviveRemaining: 5,
    });
    expect(normalized?.usedItemKinds).toEqual(['undo', 'spawn']);
    expect(normalized?.reviveRemaining).toBe(1);
  });

  it('rejects a session without a run id', () => {
    expect(normalizeSavedRun({ ...sampleRun(), runId: '' })).toBeNull();
  });

  it('rejects an invalid board', () => {
    expect(normalizeSavedRun({
      ...sampleRun(),
      board: { size: 4, tiles: [{ id: 'x', level: 99, row: 0, col: 0 }] },
    })).toBeNull();
  });

  it('defaults missing gameplay stats for older saves', () => {
    const { moves: _moves, merges: _merges, ...legacy } = sampleRun();
    const normalized = normalizeSavedRun(legacy);
    expect(normalized?.moves).toBe(0);
    expect(normalized?.merges).toBe(0);
  });
});
