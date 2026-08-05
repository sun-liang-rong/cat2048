import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  public async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { data: { status: 'ok' } };
  }
}
