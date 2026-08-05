import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PlayersModule } from '../players/players.module';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { WECHAT_CODE_CLIENT, WechatHttpClient } from './wechat.client';
import { WechatAuthService } from './wechat-auth.service';

@Module({
  imports: [
    ConfigModule,
    PlayersModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    WechatAuthService,
    WechatHttpClient,
    { provide: WECHAT_CODE_CLIENT, useExisting: WechatHttpClient },
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
