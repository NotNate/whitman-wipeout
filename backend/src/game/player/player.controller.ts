import { Controller, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'auth/guards';
import { getUserIdFromRequest } from 'utils/request';
import { PlayerService } from './player.service';
import { Request } from 'express';
import { MongoId } from 'utils/mongo';
import { QueryRequired } from 'utils/decorators';
import { LeaderboardPlayerInfo } from 'shared/api/game/player';


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

  @Post('inviteTeam')
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

  @Post('getInvites')
  @UseGuards(JwtAuthGuard)
  async getInvites(
    @Req() req: Request,
    @QueryRequired('gameId') gameIdQuery: string,
  ): Promise<string[]> {
    const userId = getUserIdFromRequest(req);
    const gameId = new MongoId(gameIdQuery);
    const invites = await this.plyr.getInvites(userId, gameId);
    return invites;
  }
  
  @Post('getInvitedBy')
  @UseGuards(JwtAuthGuard)
  async getInvitedBy(
    @Req() req: Request,
    @QueryRequired('gameId') gameIdQuery: string,
  ): Promise<string[]> {
    const userId = getUserIdFromRequest(req);
    const gameId = new MongoId(gameIdQuery);
    const invitedBy = await this.plyr.getInvitedBy(userId, gameId);
    return invitedBy;
  }


  /**
   * Get all players in the game except the current user with LeaderboardPlayerInfo[]
   */
  @Post('getAllPlayersInfo')
  @UseGuards(JwtAuthGuard)
  async getAllPlayersInfo(
    @Req() req: Request,
    @QueryRequired('gameId') gameIdQuery: string,
  ): Promise<LeaderboardPlayerInfo[]> {
    const userId = getUserIdFromRequest(req);
    const gameId = new MongoId(gameIdQuery);
    const playersInfo = await this.plyr.getAllPlayersExcept(userId, gameId);
    return playersInfo;
  }
}
