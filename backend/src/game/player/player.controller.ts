import { Controller, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'auth/guards';
import { getUserIdFromRequest } from 'utils/request';
import { PlayerService } from './player.service';
import { Request } from 'express';
import { MongoId } from 'utils/mongo';
import { QueryRequired } from 'utils/decorators';

@Controller('game/player')
export class PlayerController {
  constructor(private plyr: PlayerService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  async register(
    @Req() req: Request,
    @QueryRequired('gameId') gameIdQuery: string,
  ) {
    const userId = getUserIdFromRequest(req);
    const gameId = new MongoId(gameIdQuery);
    await this.plyr.register(userId, gameId);
    return { msg: 'success' };
  }

  @Post('invite-team')
  @UseGuards(JwtAuthGuard)
  async inviteTeam(
    @Req() req: Request,
    @QueryRequired('gameId') gameIdQuery: string,
    @QueryRequired('teamPartnerId') teamPartnerIdQuery: string,
  ) {
    const userId = getUserIdFromRequest(req);
    const gameId = new MongoId(gameIdQuery);
    const teamPartnerId = new MongoId(teamPartnerIdQuery);
    await this.plyr.inviteTeam(userId, gameId, teamPartnerId);
    return { msg: 'success' };
  }
}
