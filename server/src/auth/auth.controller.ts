import { Body, Controller, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { WechatAuthService } from './wechat-auth.service';

@Controller('v1/auth')
export class AuthController {
  public constructor(@Inject(WechatAuthService) private readonly auth: WechatAuthService) {}

  @Post('wechat')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async login(@Body() body: WechatLoginDto) {
    return { data: await this.auth.login(body.code) };
  }
}
