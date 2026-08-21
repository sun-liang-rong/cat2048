import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { LeaderboardService } from './leaderboard.service';

@Controller('v1/leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  public constructor(@Inject(LeaderboardService) private readonly leaderboard: LeaderboardService) {}

  @Post('scores')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  public async submitScore(@Req() request: AuthenticatedRequest, @Body() body: SubmitScoreDto) {
    return {
      data: await this.leaderboard.submitScore(request.user.playerId, body),
    };
  }

  @Get()
  public async getLeaderboard(
    @Req() request: AuthenticatedRequest,
    @Query() query: LeaderboardQueryDto,
  ) {
    const rawLimit = query.limit as unknown;
    const limit = rawLimit === undefined ? 50 : Number(rawLimit);
    return {
      data: await this.leaderboard.getLeaderboard(request.user.playerId, limit),
    };
  }
}
