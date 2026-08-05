import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest } from './authenticated-request';

interface AccessTokenPayload {
  readonly sub?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  public constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
    if (!token) throw new UnauthorizedException('Bearer token is required');

    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token);
      if (!payload.sub) throw new Error('Missing subject');
      request.user = { playerId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
