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

  it('submits a batch and returns per-score results with the final rank', async () => {
    const repository = {
      recordScore: vi.fn()
        .mockResolvedValueOnce({
          duplicate: false,
          accepted: true,
          highScore: 1024,
          highScoreAt: new Date('2026-08-05T00:00:00.000Z'),
        })
        .mockResolvedValueOnce({
          duplicate: false,
          accepted: true,
          highScore: 2048,
          highScoreAt: new Date('2026-08-06T00:00:00.000Z'),
        }),
      getPlayerRank: vi.fn().mockResolvedValue(5),
      getLeaderboard: vi.fn(),
    };
    const service = new LeaderboardService(repository);

    await expect(service.submitScores('player-1', [
      { runId: 'run-1', score: 1024, highestLevel: 4 },
      { runId: 'run-2', score: 2048, highestLevel: 6 },
    ])).resolves.toEqual({
      results: [
        { runId: 'run-1', score: 1024, accepted: true, duplicate: false, highScore: 1024, rank: 5 },
        { runId: 'run-2', score: 2048, accepted: true, duplicate: false, highScore: 2048, rank: 5 },
      ],
    });
    expect(repository.recordScore).toHaveBeenCalledTimes(2);
    expect(repository.getPlayerRank).toHaveBeenCalledOnce();
  });

  it('rejects the whole batch when any score is invalid', async () => {
    const repository = {
      recordScore: vi.fn(),
      getPlayerRank: vi.fn(),
      getLeaderboard: vi.fn(),
    };
    const service = new LeaderboardService(repository);

    await expect(service.submitScores('player-1', [
      { runId: 'run-1', score: 100, highestLevel: 2 },
      { runId: 'run-bad', score: -5, highestLevel: 3 },
    ])).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.recordScore).not.toHaveBeenCalled();
  });
});
