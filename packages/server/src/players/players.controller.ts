import { Body, Controller, Inject, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PlayersService } from './players.service';

@Controller('v1/players/me')
@UseGuards(JwtAuthGuard)
export class PlayersController {
  public constructor(@Inject(PlayersService) private readonly players: PlayersService) {}

  @Patch('profile')
  public async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateProfileDto,
  ) {
    const player = await this.players.updateProfile(
      request.user.playerId,
      body.nickname,
      body.avatarUrl,
    );
    return { data: { player } };
  }
}
