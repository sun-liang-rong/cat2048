import { Inject, Injectable } from '@nestjs/common';
import { EconomyRepository } from './economy.repository';
import type { EconomyItemKind } from './economy.types';
import type { MigrateEconomyDto } from './dto/economy.dto';

@Injectable()
export class EconomyService {
  public constructor(@Inject(EconomyRepository) private readonly repository: EconomyRepository) {}

  public bootstrap(playerId: string) { return this.repository.bootstrap(playerId); }
  public migrate(playerId: string, migrationId: string, input: MigrateEconomyDto) {
    return this.repository.migrate(playerId, migrationId, input);
  }
  public claimDaily(playerId: string, key: string) { return this.repository.claimDaily(playerId, key); }
  public settleRun(playerId: string, key: string, input: { runId: string; score: number; highestLevel: number; discoveredLevels?: number[] }) {
    return this.repository.settleRun(playerId, key, input);
  }
  public purchase(playerId: string, key: string, itemId: string) { return this.repository.purchase(playerId, key, itemId); }
  public equip(playerId: string, key: string, itemId: string) { return this.repository.equip(playerId, key, itemId); }
  public consumeItem(playerId: string, key: string, kind: EconomyItemKind, amount: number) {
    return this.repository.consumeItem(playerId, key, kind, amount);
  }
  public adReward(playerId: string, key: string, kind: EconomyItemKind) { return this.repository.adReward(playerId, key, kind); }
  public claimTask(playerId: string, key: string, taskId: string) { return this.repository.claimTask(playerId, key, taskId); }
}
