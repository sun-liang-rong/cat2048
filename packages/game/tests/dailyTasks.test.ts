import { describe, expect, it } from 'vitest';
import {
  DAILY_TASKS,
  DAILY_TASKS_SAVE_KEY,
  LocalDailyTaskRepository,
  normalizeDailyTasks,
  type DailyTaskKind,
} from '../assets/scripts/features/tasks/dailyTasks';
import type { KeyValueStorage } from '../assets/scripts/features/storage/storage';
import type { EconomyClock } from '../assets/scripts/features/economy/economy';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null { return this.values.get(key) ?? null; }
  public setItem(key: string, value: string): void { this.values.set(key, value); }
}

function fixedClock(today: string): EconomyClock {
  return { today: () => today };
}

function taskByKind(repository: LocalDailyTaskRepository, kind: DailyTaskKind) {
  return repository.snapshot().items.find((item) => item.kind === kind);
}

describe('LocalDailyTaskRepository', () => {
  it('starts with all tasks at zero and unclaimed', () => {
    const repository = new LocalDailyTaskRepository(new MemoryStorage(), fixedClock('2026-08-08'));
    const snapshot = repository.snapshot();
    expect(snapshot.date).toBe('2026-08-08');
    expect(snapshot.canClaim).toBe(false);
    expect(snapshot.items).toHaveLength(DAILY_TASKS.length);
    expect(snapshot.items.every((item) => item.progress === 0 && !item.claimed)).toBe(true);
  });

  it('records event progress and clamps at the target', () => {
    const repository = new LocalDailyTaskRepository(new MemoryStorage(), fixedClock('2026-08-08'));
    repository.recordEvent('play-runs');
    repository.recordEvent('play-runs');
    expect(taskByKind(repository, 'play-runs')?.progress).toBe(2);
    repository.recordEvent('play-runs', 5);
    expect(taskByKind(repository, 'play-runs')?.progress).toBe(3);
  });

  it('does not record progress for a claimed task', () => {
    const storage = new MemoryStorage();
    storage.setItem(DAILY_TASKS_SAVE_KEY, JSON.stringify({
      date: '2026-08-08',
      tasks: { 'play-3': { progress: 3, claimed: true } },
    }));
    const repository = new LocalDailyTaskRepository(storage, fixedClock('2026-08-08'));
    repository.recordEvent('play-runs');
    expect(taskByKind(repository, 'play-runs')?.progress).toBe(3);
  });

  it('rejects claiming an incomplete task', () => {
    const repository = new LocalDailyTaskRepository(new MemoryStorage(), fixedClock('2026-08-08'));
    const result = repository.claim('play-3');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('incomplete');
    expect(result.awardedCoins).toBe(0);
  });

  it('claims a completed task once and grants its reward', () => {
    const repository = new LocalDailyTaskRepository(new MemoryStorage(), fixedClock('2026-08-08'));
    repository.recordEvent('share-once');
    const first = repository.claim('share-1');
    expect(first.ok).toBe(true);
    expect(first.awardedCoins).toBe(20);
    expect(first.snapshot.items.find((item) => item.id === 'share-1')?.claimed).toBe(true);
    expect(first.snapshot.canClaim).toBe(false);

    const second = repository.claim('share-1');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already-claimed');
  });

  it('rejects unknown task ids', () => {
    const repository = new LocalDailyTaskRepository(new MemoryStorage(), fixedClock('2026-08-08'));
    const result = repository.claim('nope');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not-found');
  });

  it('resets all progress when the date changes', () => {
    const storage = new MemoryStorage();
    const first = new LocalDailyTaskRepository(storage, fixedClock('2026-08-08'));
    first.recordEvent('play-runs', 3);
    first.recordEvent('use-items', 2);
    expect(taskByKind(first, 'play-runs')?.progress).toBe(3);

    const nextDay = new LocalDailyTaskRepository(storage, fixedClock('2026-08-09'));
    expect(taskByKind(nextDay, 'play-runs')?.progress).toBe(0);
    expect(taskByKind(nextDay, 'use-items')?.progress).toBe(0);
    expect(taskByKind(nextDay, 'play-runs')?.claimed).toBe(false);
  });

  it('persists progress across repository instances on the same day', () => {
    const storage = new MemoryStorage();
    const first = new LocalDailyTaskRepository(storage, fixedClock('2026-08-08'));
    first.recordEvent('use-items');
    first.recordEvent('use-items');
    const second = new LocalDailyTaskRepository(storage, fixedClock('2026-08-08'));
    expect(taskByKind(second, 'use-items')?.progress).toBe(2);
  });

  it('repairs corrupt storage to fresh defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem(DAILY_TASKS_SAVE_KEY, '{broken json');
    const repository = new LocalDailyTaskRepository(storage, fixedClock('2026-08-08'));
    expect(repository.snapshot().items.every((item) => item.progress === 0)).toBe(true);
  });
});

describe('normalizeDailyTasks', () => {
  it('fills missing tasks and clamps out-of-range progress', () => {
    const normalized = normalizeDailyTasks({
      date: '2026-08-08',
      tasks: { 'play-3': { progress: 99, claimed: false } },
    }, '2026-08-08');
    expect(normalized).not.toBeNull();
    expect(normalized?.tasks['play-3']?.progress).toBe(3);
    expect(normalized?.tasks['use-items-2']?.progress).toBe(0);
  });

  it('returns null for non-object input', () => {
    expect(normalizeDailyTasks('nope', '2026-08-08')).toBeNull();
  });
});
