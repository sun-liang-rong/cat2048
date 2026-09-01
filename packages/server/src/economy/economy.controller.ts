import { BadRequestException, Body, Controller, Headers, Inject, Post, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { EconomyService } from './economy.service';
import { DailyClaimDto, ItemMutationDto, MigrateEconomyDto, PurchaseEconomyDto, EquipEconomyDto, RunRewardDto, TaskRewardDto } from './dto/economy.dto';

@Controller('v1/economy')
@UseGuards(JwtAuthGuard)
export class EconomyController {
  public constructor(@Inject(EconomyService) private readonly economy: EconomyService) {}

  @Get('bootstrap')
  public async bootstrap(@Req() request: AuthenticatedRequest) {
    return { data: await this.economy.bootstrap(request.user.playerId) };
  }

  @Post('migrate')
  public async migrate(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: MigrateEconomyDto) {
    return { data: await this.economy.migrate(request.user.playerId, this.requireKey(key), body) };
  }

  @Post('daily-claim')
  public async dailyClaim(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: DailyClaimDto) {
    return { data: await this.economy.claimDaily(request.user.playerId, this.requireKey(key), body?.doubleReward === true) };
  }

  @Post('run-reward')
  public async runReward(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: RunRewardDto) {
    return { data: await this.economy.settleRun(request.user.playerId, this.requireKey(key), body) };
  }

  @Post('purchase')
  public async purchase(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: PurchaseEconomyDto) {
    return { data: await this.economy.purchase(request.user.playerId, this.requireKey(key), body.itemId) };
  }

  @Post('equip')
  public async equip(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: EquipEconomyDto) {
    return { data: await this.economy.equip(request.user.playerId, this.requireKey(key), body.itemId) };
  }

  @Post('items/consume')
  public async consume(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: ItemMutationDto) {
    return { data: await this.economy.consumeItem(request.user.playerId, this.requireKey(key), body.kind as never, body.amount) };
  }

  @Post('items/ad-reward')
  public async adReward(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: ItemMutationDto) {
    return { data: await this.economy.adReward(request.user.playerId, this.requireKey(key), body.kind as never) };
  }

  @Post('task-reward')
  public async taskReward(@Req() request: AuthenticatedRequest, @Headers('idempotency-key') key: string, @Body() body: TaskRewardDto) {
    return { data: await this.economy.claimTask(request.user.playerId, this.requireKey(key), body.taskId) };
  }

  private requireKey(key: string | undefined): string {
    if (!key?.trim() || key.length > 128) throw new BadRequestException('Idempotency-Key is required');
    return key.trim();
  }
}
