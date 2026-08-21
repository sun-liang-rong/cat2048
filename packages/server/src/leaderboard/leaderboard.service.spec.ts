import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardService', () => {
  it('submits a valid score and returns the updated rank', async () => {
    const repository = {
      recordScore: vi.fn().mockResolvedValue({
        duplicate: false,
        accepted: true,
        highScore: 2048,
        highScoreAt: new Date('2026-08-05T00:00:00.000Z'),
      }),
      getPlayerRank: vi.fn().mockResolvedValue(3),
      getLeaderboard: vi.fn(),
    };
    const service = new LeaderboardService(repository);

    await expect(service.submitScore('player-1', {
      runId: 'run-1',
      score: 2048,
      highestLevel: 5,
    })).resolves.toMatchObject({
      runId: 'run-1',
      accepted: true,
      duplicate: false,
      highScore: 2048,
      rank: 3,
    });
  });

  it('returns duplicate submissions without recording them again', async () => {
    const repository = {
      recordScore: vi.fn().mockResolvedValue({
        duplicate: true,
        accepted: false,
        highScore: 1024,
        highScoreAt: new Date('2026-08-05T00:00:00.000Z'),
      }),
      getPlayerRank: vi.fn().mockResolvedValue(7),
      getLeaderboard: vi.fn(),
    };
    const service = new LeaderboardService(repository);

    await expect(service.submitScore('player-1', {
      runId: 'run-1',
      score: 512,
      highestLevel: 4,
    })).resolves.toMatchObject({
      accepted: false,
      duplicate: true,
      highScore: 1024,
      rank: 7,
    });
    expect(repository.recordScore).toHaveBeenCalledOnce();
  });

  it('rejects scores outside the game contract', async () => {
    const repository = {
      recordScore: vi.fn(),
      getPlayerRank: vi.fn(),
      getLeaderboard: vi.fn(),
    };
    const service = new LeaderboardService(repository);

    await expect(service.submitScore('player-1', {
      runId: 'run-1',
      score: -1,
      highestLevel: 4,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.recordScore).not.toHaveBeenCalled();
  });
});
