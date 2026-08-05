import { describe, expect, it, vi } from 'vitest';
import { LeaderboardRepository } from './leaderboard.repository';

describe('LeaderboardRepository', () => {
  it('records a first score of zero so the player receives a leaderboard timestamp', async () => {
    const highScoreAt = new Date('2026-08-05T00:00:00.000Z');
    const transaction = {
      scoreSubmission: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
      },
      player: {
        updateMany: vi.fn((args: { where: { OR?: unknown[] } }) => ({
          count: args.where.OR ? 1 : 0,
        })),
        findUnique: vi.fn().mockResolvedValue({ highScore: 0, highScoreAt }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ highScore: 0, highScoreAt }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    };
    const repository = new LeaderboardRepository(prisma as never);

    await expect(repository.recordScore({
      playerId: 'player-1',
      runId: 'run-1',
      score: 0,
      highestLevel: 1,
    })).resolves.toMatchObject({
      accepted: true,
      duplicate: false,
      highScore: 0,
      highScoreAt,
    });
  });
});
