import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { LeaderboardRepository, type LeaderboardStore } from './leaderboard.repository';
import type { LeaderboardResult, ScoreSubmissionInput } from './leaderboard.types';

const MAX_SCORE = 2147483647;
const MAX_RUN_ID_LENGTH = 64;

@Injectable()
export class LeaderboardService {
  public constructor(@Inject(LeaderboardRepository) private readonly repository: LeaderboardStore) {}

  public async submitScore(playerId: string, input: Omit<ScoreSubmissionInput, 'playerId'>) {
    this.validateScore(input);
    const result = await this.repository.recordScore({ playerId, ...input });
    const rank = await this.repository.getPlayerRank(playerId);
    return {
      runId: input.runId,
      score: input.score,
      accepted: result.accepted,
      duplicate: result.duplicate,
      highScore: result.highScore,
      rank,
    };
  }

  public getLeaderboard(playerId: string, limit: number): Promise<LeaderboardResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be an integer between 1 and 100');
    }
    return this.repository.getLeaderboard(limit, playerId);
  }

  private validateScore(input: Omit<ScoreSubmissionInput, 'playerId'>): void {
    if (!input.runId.trim() || input.runId.length > MAX_RUN_ID_LENGTH) {
      throw new BadRequestException('runId must be between 1 and 64 characters');
    }
    if (!Number.isSafeInteger(input.score) || input.score < 0 || input.score > MAX_SCORE) {
      throw new BadRequestException('score is outside the supported range');
    }
    if (!Number.isInteger(input.highestLevel) || input.highestLevel < 1 || input.highestLevel > 12) {
      throw new BadRequestException('highestLevel must be between 1 and 12');
    }
  }
}
