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

  /**
   * 批量提交成绩：逐条落库后统一返回结果列表。
   * 任一条目校验失败则整批拒绝（客户端会回退为逐条提交以定位坏数据）。
   * 排名只查询一次（全部落库后的最终排名），避免批量场景下的重复计数开销。
   */
  public async submitScores(playerId: string, inputs: ReadonlyArray<Omit<ScoreSubmissionInput, 'playerId'>>) {
    inputs.forEach((input, index) => this.validateScore(input, index));
    const results = [];
    for (const input of inputs) {
      const result = await this.repository.recordScore({ playerId, ...input });
      results.push({
        runId: input.runId,
        score: input.score,
        accepted: result.accepted,
        duplicate: result.duplicate,
        highScore: result.highScore,
      });
    }
    const rank = await this.repository.getPlayerRank(playerId);
    return { results: results.map((result) => ({ ...result, rank })) };
  }

  public getLeaderboard(playerId: string, limit: number): Promise<LeaderboardResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be an integer between 1 and 100');
    }
    return this.repository.getLeaderboard(limit, playerId);
  }

  private validateScore(input: Omit<ScoreSubmissionInput, 'playerId'>, index?: number): void {
    const label = index === undefined ? 'score' : `scores[${index}]`;
    if (!input.runId.trim() || input.runId.length > MAX_RUN_ID_LENGTH) {
      throw new BadRequestException(`${label}.runId must be between 1 and 64 characters`);
    }
    if (!Number.isSafeInteger(input.score) || input.score < 0 || input.score > MAX_SCORE) {
      throw new BadRequestException(`${label}.score is outside the supported range`);
    }
    if (!Number.isInteger(input.highestLevel) || input.highestLevel < 1 || input.highestLevel > 12) {
      throw new BadRequestException(`${label}.highestLevel must be between 1 and 12`);
    }
  }
}
