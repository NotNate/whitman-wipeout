import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { GameService } from 'game/game.service';
import { UserService } from 'user/user.service';
import { MongoId } from 'utils/mongo';
import { Player, PlayerRole, PlayerStatus } from './player.schema';
import { User } from 'user/user.schema';
import { Model } from 'mongoose';
import { GameStatus } from 'game/game.schema';
import {
  EmailNotWhitelistedException,
  GameStatusNotValidException,
  PlayerNotFoundException,
} from 'utils/exceptions';

import { LeaderboardPlayerInfo } from 'shared/api/game/player';

@Injectable()
export class PlayerService {
  constructor(
    @InjectModel(Player.name) private model: Model<Player>,
    private gme: GameService,
    private usr: UserService,
  ) {}

  /**
   * Register a given user to play a game.
   * @param gameId The game in question
   * @param userId The user to register for the game in question
   */
  async register(userId: MongoId, gameId: MongoId) {
    const game = await this.gme.findById(gameId);
    const user = await this.usr.findById(userId);

    // Only allow for player's to register while the game is in setup mode
    if (game.status != GameStatus.SETUP) {
      throw new GameStatusNotValidException(gameId, game.status);
    }

    // If the game has listed a bunch of emails, make sure to check our email is there
    if (game.whitelistedEmails && game.whitelistedEmails.length != 0) {
      if (!game.whitelistedEmails.includes(user.email)) {
        throw new EmailNotWhitelistedException(userId, gameId);
      }
    }

    // Make sure the player isn't already registered
    if ((await this.find(userId, gameId)) === null) {
      const player = new this.model();
      player.gameId = gameId;
      player.userId = userId;
      player.save();
    }
  }

  /**
   * Return the role for user (`userId`) in the context of game (`gamdId`)
   * @param gameId The unique ID for the game
   * @param userId The unique ID for the general user
   */
  async getRole(gameId: MongoId, userId: MongoId): Promise<PlayerRole> {
    const user = await this.usr.findById(userId);
    const game = await this.gme.findById(gameId);

    const email = user.email;
    // If this user's email is listed in the set of admins
    if (game.admins.includes(email)) {
      return PlayerRole.ADMIN;
    }

    const player = await this.find(userId, gameId);
    const registered = player !== null;
    if (registered) {
      return PlayerRole.PLAYER;
    }

    // If the user is not an admin OR a player, they must be a nobody (what a shame)
    return PlayerRole.NONE;
  }

  async find(userId: MongoId, gameId: MongoId): Promise<Player | null> {
    return await this.model
      .find({ gameId: gameId, userId: userId })
      .findOne()
      .exec();
  }

  /**
   * Get a player simply via their user ID. NOTE: This just gets the most
   * recent player, and totally breaks when there are multiple games.
   * @param userId The ID of the user to find
   */
  async getByUser_DEPRECATED(userId: MongoId): Promise<Player> {
    return await this.model
      .find({ userId: userId })
      .sort({ _id: -1 })
      .findOne()
      .exec();
  }

  async findById(playerId: MongoId): Promise<Player> {
    const query = await this.model.find({ _id: playerId }).exec();
    if (!query) {
      throw new PlayerNotFoundException(playerId);
    }

    return query[0];
  }

  async findByGameAndStatus(
    gameId: MongoId,
    status: PlayerStatus = PlayerStatus.ALIVE,
  ): Promise<Player[]> {
    return await this.model.find({ gameId: gameId, status }).exec();
  }

  async findByGame(gameId: MongoId): Promise<Player[]> {
    return await this.model.find({ gameId: gameId }).exec();
  }

  async inviteTeam(
    userId: MongoId,
    gameId: MongoId,
    teamPartnerPlayerId: MongoId,
  ) {
    const user = await this.find(userId, gameId);
    const teamPartner = await this.findById(teamPartnerPlayerId);
  
    if (!teamPartner) {
        throw new PlayerNotFoundException(teamPartnerPlayerId);
    }
  
    if (!user) {
        throw new PlayerNotFoundException(userId);
    }
  
    // Check if the team partner has already been invited by the user
    if (teamPartner.invitedBy.includes(user.userId)) {
        throw new Error('Team partner has already been invited by this user.');
    }
  
    // Proceed to update lists using user IDs
    teamPartner.invitedBy.push(user.userId);
    await teamPartner.save();
  
    user.invited.push(teamPartner.userId);
    await user.save();
  }

  async getInvites(userId: MongoId, gameId: MongoId): Promise<MongoId[]> {
    const player = await this.find(userId, gameId);
    if (player.userId != userId) {
      const role = await this.getRole(gameId, userId);
      if (role != PlayerRole.ADMIN) {
        return [];
      }
    }
    return player.invited;
  }

  async getInvitedBy(userId: MongoId, gameId: MongoId): Promise<MongoId[]> {
    // only return the list if the player is requesting their own list, or if they are an admin
    const player = await this.find(userId, gameId);
    if (player.userId != userId) {
      const role = await this.getRole(gameId, userId);
      if (role != PlayerRole.ADMIN) {
        return [];
      }
    }
    return player.invitedBy;
  }

  /**
   * Get all players in a game except the current user and return LeaderboardPlayerInfo[]
   * @param currentUserId The ID of the current user.
   * @param gameId The game ID.
   */
  async getAllPlayersExcept(currentUserId: MongoId, gameId: MongoId): Promise<LeaderboardPlayerInfo[]> {
    // Fetch all players except the current user
    const players = await this.model.find({ gameId, userId: { $ne: currentUserId } }).exec();

    if (!players || players.length === 0) {
      return [];
    }

    // Extract player IDs and user IDs
    const playerIds = players.map(player => player.id);
    const userIds = players.map(player => player.userId);

    // Fetch user details
    const usersArray = await this.usr.findByIds(userIds); // Assumes findByIds returns User[]
    const users: { [key: string]: User } = {};
    usersArray.forEach(user => {
      users[user.id] = user;
    });

    // Fetch kill counts and killers using aggregation
    const countObjects = await this.model.aggregate([
      {
        $match: {
          status: 'COMPLETE',
          playerId: { $in: playerIds.map(pid => new MongoId(pid)) },
        },
      },
      {
        $group: {
          _id: '$playerId',
          count: { $sum: 1 },
          killed: { $push: '$targetId' },
        },
      },
    ]).exec();

    const killCounts: { [key: string]: number } = {};
    const killers: { [key: string]: string } = {};

    countObjects.forEach(doc => {
      killCounts[doc._id.toString()] = doc.count;
      if (doc.killed) {
        doc.killed.forEach((killedId: string) => {
          killers[killedId.toString()] = doc._id.toString();
        });
      }
    });

    // Construct LeaderboardPlayerInfo[]
    const allInfo: LeaderboardPlayerInfo[] = players.map(player => {
      const user = users[player.userId.toString()];
      const killerId = killers[player.id];
      const killer = killerId ? users[killerId]?.firstName && users[killerId]?.surname
        ? `${users[killerId].firstName} ${users[killerId].surname}`
        : undefined
        : undefined;

      const info: LeaderboardPlayerInfo = {
        playerId: player.id,
        userId: player.userId.toString(),
        teamPartnerId: player.teamPartnerId ? player.teamPartnerId.toString() : '',
        name: user ? `${user.firstName} ${user.surname}` : 'Unknown',
        kills: killCounts[player.id] ?? 0,
        alive: player.status === PlayerStatus.ALIVE,
        safe: player.status === PlayerStatus.SAFE,
        killedBy: killer,
      };

      return info;
    });

    return allInfo;
  }

  // TODO: Implement acceptInvite and rejectInvite
}
