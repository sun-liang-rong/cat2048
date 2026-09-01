import { describe, expect, it, vi } from 'vitest';
import { EconomyService } from './economy.service';

describe('EconomyService', () => {
  it('delegates bootstrap and migration to the repository', async () => {
    const repository = {
      bootstrap: vi.fn().mockResolvedValue({ coins: 100 }),
      migrate: vi.fn().mockResolvedValue({ coins: 200 }),
    };
    const service = new EconomyService(repository as never);

    await expect(service.bootstrap('player-1')).resolves.toEqual({ coins: 100 });
    await expect(service.migrate('player-1', 'migration-1', { migrationVersion: 1 } as never))
      .resolves.toEqual({ coins: 200 });
    expect(repository.bootstrap).toHaveBeenCalledWith('player-1');
    expect(repository.migrate).toHaveBeenCalledWith('player-1', 'migration-1', { migrationVersion: 1 });
  });

  it('exposes task reward and gameplay mutation commands', async () => {
    const repository = {
      claimTask: vi.fn().mockResolvedValue({ ok: true }),
      settleRun: vi.fn().mockResolvedValue({ ok: true }),
    };
    const service = new EconomyService(repository as never);

    await service.claimTask('player-1', 'task-key', 'play-3');
    await service.settleRun('player-1', 'run-key', { runId: 'run-1', score: 100, highestLevel: 2 });
    expect(repository.claimTask).toHaveBeenCalledWith('player-1', 'task-key', 'play-3');
    expect(repository.settleRun).toHaveBeenCalledWith('player-1', 'run-key', { runId: 'run-1', score: 100, highestLevel: 2 });
  });

  it('forwards the daily reward multiplier choice', async () => {
    const repository = {
      claimDaily: vi.fn().mockResolvedValue({ ok: true, awardedCoins: 100 }),
    };
    const service = new EconomyService(repository as never);

    await service.claimDaily('player-1', 'daily-key', true);

    expect(repository.claimDaily).toHaveBeenCalledWith('player-1', 'daily-key', true);
  });
});
