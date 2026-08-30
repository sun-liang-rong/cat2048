import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EconomyController } from './economy.controller';
import { EconomyRepository } from './economy.repository';
import { EconomyService } from './economy.service';

@Module({
  imports: [AuthModule],
  controllers: [EconomyController],
  providers: [EconomyRepository, EconomyService],
})
export class EconomyModule {}
