import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ECONOMY,
  DEFAULT_EQUIPPED,
} from '../assets/scripts/features/economy/catalog';
import {
  migrateV1Save,
  normalizeSave,
} from '../assets/scripts/features/storage/validate';
import type { SaveDataV3 } from '../assets/scripts/features/storage/saveTypes';

describe('normalizeSave', () => {
  it('accepts a complete V3 save', () => {
    const save: SaveDataV3 = {
      schemaVersion: 3,
      highScore: 2048,
      soundEnabled: true,
      musicEnabled: false,
      hapticsEnabled: true,
      unlockedCatLevels: [1, 3],
      tutorial: {
        swipeGuideCompleted: true,
      },
      economy: {
        ...DEFAULT_ECONOMY,
        ownedItemIds: [...DEFAULT_ECONOMY.ownedItemIds],
        equipped: { ...DEFAULT_ECONOMY.equipped },
      },
    };
    const normalized = normalizeSave(save);
    expect(normalized).not.toBeNull();
    expect(normalized?.schemaVersion).toBe(3);
    expect(normalized?.highScore).toBe(2048);
    expect(normalized?.economy.equipped).toEqual(DEFAULT_EQUIPPED);
  });

  it('normalizes legacy saves that still carry retired tutorial flags', () => {
    const legacy = {
      schemaVersion: 3,
      highScore: 64,
      soundEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      unlockedCatLevels: [1, 2],
      tutorial: {
        swipeGuideCompleted: true,
        itemRefillGuideCompleted: true,
        collectionGuideCompleted: true,
      },
      economy: { ...DEFAULT_ECONOMY },
    };
    const normalized = normalizeSave(legacy);
    expect(normalized?.tutorial).toEqual({ swipeGuideCompleted: true });
  });

  it('rejects non-object values', () => {
    expect(normalizeSave(null)).toBeNull();
    expect(normalizeSave('junk')).toBeNull();
    expect(normalizeSave(42)).toBeNull();
  });

  it('rejects missing economy section', () => {
    const partial = { schemaVersion: 3, highScore: 0, unlockedCatLevels: [1] };
    expect(normalizeSave(partial)).toBeNull();
  });

  it('normalizes unlocked levels by deduplicating and sorting', () => {
    const save = {
      schemaVersion: 3,
      highScore: 10,
      soundEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      unlockedCatLevels: [5, 1, 3, 3],
      tutorial: { swipeGuideCompleted: true },
      economy: { ...DEFAULT_ECONOMY },
    };
    const normalized = normalizeSave(save);
    expect(normalized?.unlockedCatLevels).toEqual([1, 3, 5]);
  });

  it('defaults missing musicEnabled to true', () => {
    const save = {
      schemaVersion: 3,
      highScore: 0,
      soundEnabled: true,
      hapticsEnabled: true,
      unlockedCatLevels: [1],
      tutorial: { swipeGuideCompleted: true },
      economy: { ...DEFAULT_ECONOMY },
    };
    const normalized = normalizeSave(save);
    expect(normalized?.musicEnabled).toBe(true);
  });

  it('migrates V2 saves by attaching a fresh economy', () => {
    const v2 = {
      schemaVersion: 2,
      highScore: 512,
      soundEnabled: true,
      hapticsEnabled: false,
      unlockedCatLevels: [1, 2],
      tutorial: { swipeGuideCompleted: true, itemRefillGuideCompleted: true, collectionGuideCompleted: false },
    };
    const normalized = normalizeSave(v2);
    expect(normalized?.schemaVersion).toBe(3);
    expect(normalized?.highScore).toBe(512);
    expect(normalized?.economy.ownedItemIds).toEqual(DEFAULT_ECONOMY.ownedItemIds);
  });
});

describe('migrateV1Save', () => {
  it('migrates a valid V1 save to V3', () => {
    const migrated = migrateV1Save({
      schemaVersion: 1,
      highScore: 128,
      soundEnabled: false,
      hapticsEnabled: true,
    });
    expect(migrated).not.toBeNull();
    expect(migrated?.schemaVersion).toBe(3);
    expect(migrated?.highScore).toBe(128);
    expect(migrated?.soundEnabled).toBe(false);
    expect(migrated?.musicEnabled).toBe(true);
    expect(migrated?.unlockedCatLevels).toEqual([1]);
  });

  it('defaults hapticsEnabled to true when absent', () => {
    const migrated = migrateV1Save({
      schemaVersion: 1,
      highScore: 0,
      soundEnabled: true,
    });
    expect(migrated?.hapticsEnabled).toBe(true);
  });

  it('rejects invalid V1 saves', () => {
    expect(migrateV1Save({ schemaVersion: 1, highScore: -1, soundEnabled: true })).toBeNull();
    expect(migrateV1Save({ schemaVersion: 2, highScore: 0, soundEnabled: true })).toBeNull();
    expect(migrateV1Save('junk')).toBeNull();
  });
});
