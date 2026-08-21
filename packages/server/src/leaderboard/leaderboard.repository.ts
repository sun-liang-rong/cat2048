import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  LeaderboardEntry,
  LeaderboardResult,
  RecordedScore,
  ScoreSubmissionInput,
} from './leaderboard.types';

export interface LeaderboardStore {
  recordScore(input: ScoreSubmissionInput): Promise<RecordedScore>;
  getPlayerRank(playerId: string): Promise<number | null>;
  getLeaderboard(limit: number, playerId: string): Promise<LeaderboardResult>;
}

@Injectable()
export class LeaderboardRepository implements LeaderboardStore {
  public constructor(private readonly prisma: PrismaService) {}

  public async recordScore(input: ScoreSubmissionInput): Promise<RecordedScore> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.scoreSubmission.findUnique({
          where: { playerId_runId: { playerId: input.playerId, runId: input.runId } },
        });
        if (existing) return this.currentScore(transaction, input.playerId, true, false);

        await transaction.scoreSubmission.create({
          data: {
            playerId: input.playerId,
            runId: input.runId,
            score: input.score,
            highestLevel: input.highestLevel,
          },
        });
        const update = await transaction.player.updateMany({
          where: {
            id: input.playerId,
            OR: [
              { highScore: { lt: input.score } },
              { highScoreAt: null },
            ],
          },
          data: { highScore: input.score, highScoreAt: new Date() },
        });
        return this.currentScore(transaction, input.playerId, false, update.count > 0);
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      return this.currentScore(this.prisma, input.playerId, true, false);
    }
  }

  public async getLeaderboard(limit: number, playerId: string): Promise<LeaderboardResult> {
    const entries = await this.prisma.player.findMany({
      where: { highScoreAt: { not: null } },
      orderBy: [
        { highScore: 'desc' },
        { highScoreAt: 'asc' },
        { id: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        highScore: true,
        highScoreAt: true,
      },
    });
    const rank = await this.getPlayerRank(playerId);
    const me = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { highScore: true, highScoreAt: true },
    });
    return {
      entries: entries.map((entry, index) => ({
        rank: index + 1,
        playerId: entry.id,
        nickname: entry.nickname,
        avatarUrl: entry.avatarUrl,
        score: entry.highScore,
        achievedAt: entry.highScoreAt as Date,
      })),
      me: me?.highScoreAt && rank !== null ? { rank, score: me.highScore } : null,
    };
  }

  public async getPlayerRank(playerId: string): Promise<number | null> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, highScore: true, highScoreAt: true },
    });
    if (!player?.highScoreAt) return null;

    const ahead = await this.prisma.player.count({
      where: {
        highScoreAt: { not: null },
        OR: [
          { highScore: { gt: player.highScore } },
          {
            highScore: player.highScore,
            highScoreAt: { lt: player.highScoreAt },
          },
          {
            highScore: player.highScore,
            highScoreAt: player.highScoreAt,
            id: { lt: player.id },
          },
        ],
      },
    });
    return ahead + 1;
  }

  private async currentScore(
    client: Prisma.TransactionClient | PrismaService,
    playerId: string,
    duplicate: boolean,
    accepted: boolean,
  ): Promise<RecordedScore> {
    const player = await client.player.findUniqueOrThrow({
      where: { id: playerId },
      select: { highScore: true, highScoreAt: true },
    });
    return {
      duplicate,
      accepted,
      highScore: player.highScore,
      highScoreAt: player.highScoreAt,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
