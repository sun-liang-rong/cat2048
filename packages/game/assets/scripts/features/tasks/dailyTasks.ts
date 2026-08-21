import type { KeyValueStorage } from '../storage/storage';
import { localDate, type EconomyClock } from '../economy/economy';

export type DailyTaskKind = 'play-runs' | 'reach-lv5' | 'use-items' | 'share-once';

export interface DailyTaskDefinition {
  readonly id: string;
  readonly kind: DailyTaskKind;
  readonly name: string;
  readonly target: number;
  readonly rewardCoins: number;
}

export interface DailyTaskProgress {
  readonly progress: number;
  readonly claimed: boolean;
}

export interface DailyTaskSaveData {
  readonly date: string;
  readonly tasks: Readonly<Record<string, DailyTaskProgress>>;
}

export interface DailyTaskItem extends DailyTaskDefinition, DailyTaskProgress {}

export interface DailyTaskSnapshot {
  readonly date: string;
  readonly items: readonly DailyTaskItem[];
  readonly canClaim: boolean;
}

export interface DailyTaskClaimResult {
  readonly ok: boolean;
  readonly awardedCoins: number;
  readonly snapshot: DailyTaskSnapshot;
  readonly reason?: 'not-found' | 'incomplete' | 'already-claimed';
}

export interface DailyTaskRepository {
  snapshot(): DailyTaskSnapshot;
  recordEvent(kind: DailyTaskKind, amount?: number): DailyTaskSnapshot;
  claim(taskId: string): DailyTaskClaimResult;
}

export const DAILY_TASKS: readonly DailyTaskDefinition[] = [
  { id: 'play-3', kind: 'play-runs', name: '完成 3 局游戏', target: 3, rewardCoins: 30 },
  { id: 'reach-lv5', kind: 'reach-lv5', name: '单局合成 Lv.5 猫咪', target: 1, rewardCoins: 30 },
  { id: 'use-items-2', kind: 'use-items', name: '使用道具 2 次', target: 2, rewardCoins: 20 },
  { id: 'share-1', kind: 'share-once', name: '分享游戏 1 次', target: 1, rewardCoins: 20 },
] as const;

export const DAILY_TASKS_SAVE_KEY = 'cat2048.daily-tasks.v1';

export function dailyTaskDefaults(): DailyTaskSaveData {
  const tasks: Record<string, DailyTaskProgress> = {};
  for (const task of DAILY_TASKS) tasks[task.id] = { progress: 0, claimed: false };
  return { date: '', tasks };
}

/** 校验并修复持久化数据；数据不合法时返回 null，由调用方重置。 */
export function normalizeDailyTasks(value: unknown, today: string): DailyTaskSaveData | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.date !== 'string' || !candidate.tasks || typeof candidate.tasks !== 'object') return null;
  const tasks: Record<string, DailyTaskProgress> = {};
  for (const task of DAILY_TASKS) {
    const raw = (candidate.tasks as Record<string, unknown>)[task.id] as Record<string, unknown> | undefined;
    const progress = typeof raw?.progress === 'number'
      && Number.isSafeInteger(raw.progress) ? Math.max(0, Math.min(task.target, raw.progress)) : 0;
    const claimed = typeof raw?.claimed === 'boolean' ? raw.claimed : false;
    tasks[task.id] = { progress, claimed };
  }
  return { date: candidate.date, tasks };
}

export class LocalDailyTaskRepository implements DailyTaskRepository {
  private readonly storage: KeyValueStorage;
  private readonly clock: EconomyClock;

  public constructor(storage: KeyValueStorage, clock: EconomyClock = { today: localDate }) {
    this.storage = storage;
    this.clock = clock;
  }

  public snapshot(): DailyTaskSnapshot {
    return this.snapshotOf(this.currentSave());
  }

  public recordEvent(kind: DailyTaskKind, amount = 1): DailyTaskSnapshot {
    const save = this.currentSave();
    const task = DAILY_TASKS.find((candidate) => candidate.kind === kind);
    if (!task || amount <= 0) return this.snapshotOf(save);
    const current = save.tasks[task.id] ?? { progress: 0, claimed: false };
    if (current.claimed) return this.snapshotOf(save);
    const next = {
      ...save,
      tasks: {
        ...save.tasks,
        [task.id]: {
          progress: Math.min(task.target, current.progress + amount),
          claimed: current.claimed,
        },
      },
    };
    this.persist(next);
    return this.snapshotOf(next);
  }

  public claim(taskId: string): DailyTaskClaimResult {
    const save = this.currentSave();
    const task = DAILY_TASKS.find((candidate) => candidate.id === taskId);
    if (!task) return { ok: false, awardedCoins: 0, snapshot: this.snapshotOf(save), reason: 'not-found' };
    const current = save.tasks[taskId] ?? { progress: 0, claimed: false };
    if (current.progress < task.target) {
      return { ok: false, awardedCoins: 0, snapshot: this.snapshotOf(save), reason: 'incomplete' };
    }
    if (current.claimed) {
      return { ok: false, awardedCoins: 0, snapshot: this.snapshotOf(save), reason: 'already-claimed' };
    }
    const next = {
      ...save,
      tasks: {
        ...save.tasks,
        [taskId]: { progress: current.progress, claimed: true },
      },
    };
    this.persist(next);
    return { ok: true, awardedCoins: task.rewardCoins, snapshot: this.snapshotOf(next) };
  }

  private currentSave(): DailyTaskSaveData {
    const today = this.clock.today();
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(DAILY_TASKS_SAVE_KEY);
      if (!raw) return this.fresh(today);
      const normalized = normalizeDailyTasks(JSON.parse(raw) as unknown, today);
      if (!normalized) return this.fresh(today);
      if (normalized.date !== today) return this.fresh(today);
      return normalized;
    } catch (error) {
      console.warn('[Cat2048] Daily task data was invalid and has been reset.', error);
      return this.fresh(today);
    }
  }

  private fresh(today: string): DailyTaskSaveData {
    const save = { ...dailyTaskDefaults(), date: today };
    this.persist(save);
    return save;
  }

  private persist(save: DailyTaskSaveData): void {
    try {
      this.storage.setItem(DAILY_TASKS_SAVE_KEY, JSON.stringify(save));
    } catch (error) {
      console.warn('[Cat2048] Failed to save daily task data.', error);
    }
  }

  private snapshotOf(save: DailyTaskSaveData): DailyTaskSnapshot {
    const items: DailyTaskItem[] = DAILY_TASKS.map((definition) => {
      const progress = save.tasks[definition.id] ?? { progress: 0, claimed: false };
      return { ...definition, ...progress };
    });
    return {
      date: save.date,
      items,
      canClaim: items.some((item) => item.progress >= item.target && !item.claimed),
    };
  }
}
