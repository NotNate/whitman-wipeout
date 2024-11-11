import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Target, TargetDocument, TargetStatus } from './target.schema';
import { Model } from 'mongoose';

// Services
import { GameService } from 'game/game.service';
import { PlayerService } from 'game/player/player.service';

// Utilities
import { MongoId } from 'utils/mongo';
import { shuffle } from 'utils/misc';
import { GameStatus } from 'game/game.schema';
import { Player, PlayerRole, PlayerStatus } from 'game/player/player.schema';
import {
  GameStatusNotValidException,
  PlayerRoleUnauthorizedException,
  PlayerStatusNotValidException,
  TargetNotFoundException,
  TargetStatusNotValidException,
} from 'utils/exceptions';

// Objects
import { TargetInfo } from 'shared/api/game/target';
import { UserService } from 'user/user.service';
import { User } from 'user/user.schema';

import { LeaderboardPlayerInfo } from 'shared/api/game/player';

@Injectable()
export class TargetService {
  constructor(
    @InjectModel(Target.name) private model: Model<Target>,
    private gme: GameService,
    private plyr: PlayerService,
    private usr: UserService,
  ) {}

  async findById(targetId: MongoId): Promise<Target> {
    const query = await this.model.find({ _id: targetId }).exec();
    if (!query) {
      throw new TargetNotFoundException(targetId);
    }
    return query[0];
  }

  async findByGameAndPlayer(
    gameId: MongoId,
    playerId: MongoId,
  ): Promise<Target> {
    const query = await this.model
      .find({
        gameId: gameId,
        playerId: playerId,
        status: TargetStatus.PENDING,
      })
      .exec();
    if (!query) {
      throw new TargetNotFoundException(gameId);
    }
    return query[0];
  }

  async findByGameAndUser(gameId: MongoId, userId: MongoId): Promise<Target> {
    const player = await this.plyr.find(userId, gameId);
    const playerId = new MongoId(player.id);
    return await this.findByGameAndPlayer(gameId, playerId);
  }

  async fetchTarget(gameId: MongoId, userId: MongoId): Promise<TargetInfo> {
    const player = await this.plyr.find(userId, gameId);
    const playerId = new MongoId(player.id);

    const game = await this.gme.findById(player.gameId);

    if (player.status !== PlayerStatus.ALIVE && player.status !== PlayerStatus.SAFE) {
      // Player is no longer alive and cannot view their target
      throw new PlayerStatusNotValidException(playerId, player.status);
    }

    if (game.status !== GameStatus.IN_PROGRESS) {
      // Player is no longer alive and cannot view their target
      throw new GameStatusNotValidException(player.gameId, game.status);
    }

    const target = await this.findByGameAndPlayer(player.gameId, playerId);
    const targetPlayer = await this.plyr.findById(target.targetId);
    const targetUser = await this.usr.findById(targetPlayer.userId);

    return {
      name: `${targetUser.firstName} ${targetUser.surname}`,
      safe: targetPlayer.status === PlayerStatus.SAFE
    };
}

  /**
   * Create targets for all alive players in a game. Expire all pending targets,
   * deactivating them.
   * @param userId The user performing the action (must be ADMIN).
   * @param gameId The game in question.
   */
  async matchPlayers(userId: MongoId, gameId: MongoId) {
    const game = await this.gme.findById(gameId);
    if (!game) {
      throw new GameStatusNotValidException(gameId, 'Game not found');
    }

    // Only allow admins to conduct this action
    const role = await this.plyr.getRole(gameId, userId);
    if (role !== PlayerRole.ADMIN) {
      throw new PlayerRoleUnauthorizedException(userId, role);
    }

    // Get all alive players
    const players = await this.plyr.findByGameAndStatus(gameId, PlayerStatus.ALIVE);

    // Group players into teams based on their teamPartnerId
    const teamsMap = new Map<string, string[]>(); // Map of team leader ID to team member IDs
    const soloPlayers: string[] = []; // Players without a partner

    for (const player of players) {
      if (player.teamPartnerId) {
        // Ensure that teamPartnerId exists in players list
        const partner = players.find(p => p.id === player.teamPartnerId);
        if (partner) {
          const teamLeaderId = player.id < partner.id ? player.id : partner.id; // Consistent ordering
          if (teamsMap.has(teamLeaderId)) {
            teamsMap.get(teamLeaderId)!.push(player.id);
          } else {
            teamsMap.set(teamLeaderId, [player.id, partner.id]);
          }
        } else {
          // Partner not found among alive players, treat as solo
          soloPlayers.push(player.id.toString());
        }
      } else {
        // Player without a partner
        soloPlayers.push(player.id.toString());
      }
    }

    // Disqualify solo players
    for (const playerId of soloPlayers) {
      const player = await this.plyr.findById(new MongoId(playerId));
      if (player) {
        player.status = PlayerStatus.DISQUALIFIED;
        await player.save();
      }
    }

    // Filter out incomplete teams (any team with only one player left due to disqualification)
    const validTeams = Array.from(teamsMap.values()).filter(team => team.length === 2);

    if (validTeams.length === 0) {
      throw new Error('No valid teams available for target assignments.');
    }

    // Shuffle the valid teams to randomize target assignments
    const shuffledTeams = shuffle(validTeams);

    const targetDocuments: TargetDocument[] = [];

    // Assign each team a target team in a circular manner
    for (let i = 0; i < shuffledTeams.length; i++) {
      const currentTeam = shuffledTeams[i];
      const targetTeam = shuffledTeams[(i + 1) % shuffledTeams.length];

      // Assign each member of the current team to target each member of the target team
      for (const playerId of currentTeam) {
        for (const targetId of targetTeam) {
          // Prevent self-targeting and teammate targeting (though unlikely in this setup)
          if (playerId === targetId) continue; // Self-targeting
          if (currentTeam.includes(targetId)) continue; // Teammate targeting

          const target = new this.model();
          target.gameId = gameId;
          target.playerId = new MongoId(playerId);
          target.targetId = new MongoId(targetId);
          target.status = TargetStatus.PENDING;
          targetDocuments.push(target);
        }
      }
    }

    // Expire all pending targets for this game
    await this.model.updateMany(
      { gameId: gameId, status: TargetStatus.PENDING },
      { $set: { status: TargetStatus.EXPIRED } },
    ).exec();

    // Insert new target assignments
    if (targetDocuments.length > 0) {
      await this.model.insertMany(targetDocuments);
    }

    // Update the game status to IN_PROGRESS if not already
    if (game.status !== GameStatus.IN_PROGRESS) {
      await game.updateOne({ $set: { status: GameStatus.IN_PROGRESS } }).exec();
    }
  }

  /**
   * Kill a target player within a game.
   * @param userId The ID of the user performing the action (must be ADMIN).
   * @param gameId The ID of the game.
   * @param targetId The ID of the target to be killed.
   */
  async killTarget(userId: MongoId, gameId: MongoId, targetId: MongoId) {
    // Ensure the game exists
    const game = await this.gme.findById(gameId);
    if (!game) {
      throw new GameStatusNotValidException(gameId, 'Game not found');
    }

    // Only allow admins to conduct this action
    const role = await this.plyr.getRole(gameId, userId);
    if (role !== PlayerRole.ADMIN) {
      throw new PlayerRoleUnauthorizedException(userId, role);
    }

    // Find the target assignment
    const target = await this.findById(targetId);
    if (!target) {
      throw new TargetNotFoundException(targetId);
    }

    // Ensure the target status is PENDING
    if (target.status !== TargetStatus.PENDING) {
      throw new TargetStatusNotValidException(targetId, target.status);
    }

    const playerId = target.playerId;
    const killedId = target.targetId;

    // Fetch the player (killer) and the killed player
    const player = await this.plyr.findById(playerId);
    if (!player) {
      throw new PlayerStatusNotValidException(playerId, 'Player not found');
    }

    const killed = await this.plyr.findById(killedId);
    if (!killed) {
      throw new PlayerStatusNotValidException(killedId, 'Killed player not found');
    }

    const killedPartnerId = killed.teamPartnerId;
    const playerPartnerId = player.teamPartnerId;

    // Ensure both player and killed target are ALIVE
    if (player.status !== PlayerStatus.ALIVE) {
      throw new PlayerStatusNotValidException(playerId, player.status);
    }
    if (killed.status !== PlayerStatus.ALIVE) {
      throw new PlayerStatusNotValidException(killedId, killed.status);
    }

    // Kill the target player
    killed.status = PlayerStatus.KILLED;
    await killed.save(); // Await the save operation

    // Mark the current target as COMPLETE
    target.status = TargetStatus.COMPLETE;
    await target.save(); // Await the save operation

    // Expire the teammate's target for the killed player
    if (killedPartnerId) {
      const partnerTarget = await this.findByGameAndPlayerAndTarget(gameId, killedPartnerId, killedId);
      if (partnerTarget) {
        partnerTarget.status = TargetStatus.EXPIRED;
        await partnerTarget.save(); // Await the save operation
      }
    }

    // Expire all targets assigned to the killed player since they're no longer in the game
    await this.model.updateMany(
      { playerId: killed.id, status: TargetStatus.PENDING },
      { $set: { status: TargetStatus.EXPIRED } },
    ).exec();

    // Check if the entire opposing team is eliminated
    const killedPartner = killedPartnerId ? await this.plyr.findById(killedPartnerId) : null;
    const isEntireTeamEliminated = killedPartner && killedPartner.status === PlayerStatus.KILLED;

    if (isEntireTeamEliminated) {
      // Expire any remaining targets of the killed team members for both players in the killing team
      for (const id of [playerId, playerPartnerId]) {
        if (id) {
          const remainingTarget = await this.findByGameAndPlayerAndTarget(gameId, id, killedPartnerId);
          if (remainingTarget) {
            remainingTarget.status = TargetStatus.EXPIRED;
            await remainingTarget.save(); // Await the save operation
          }
        }
      }

      // Assign the killing team the targets of the eliminated team
      const newTargets = await this.model.find({
        gameId: gameId,
        playerId: killedId,
        status: TargetStatus.PENDING,
      }).exec();

      for (const newTarget of newTargets) {
        for (const id of [playerId, playerPartnerId]) {
          if (id) {
            const targetAssignment = new this.model();
            targetAssignment.gameId = gameId;
            targetAssignment.playerId = id;
            targetAssignment.targetId = newTarget.targetId;
            targetAssignment.status = TargetStatus.PENDING;
            await targetAssignment.save(); // Await the save operation
          }
        }
      }
    }
  }

// Helper function to find a specific target by game, player, and target
async findByGameAndPlayerAndTarget(gameId: MongoId, playerId: MongoId, targetId: MongoId): Promise<Target | null> {
  return await this.model.findOne({
      gameId: gameId,
      playerId: playerId,
      targetId: targetId,
      status: TargetStatus.PENDING,
  }).exec();
}

  /**
   * Mark the player status of someone as safe, or make the unsafe if already marked safe.
   * @param gameId The game in question
   * @param userId The user of this function, in this case, an admin
   * @param playerId The player in the game
   */
  async makePlayerSafe(userId: MongoId, gameId: MongoId, playerId: MongoId) {
    // Grab the game to make sure it exists
    await this.gme.findById(gameId);

    // Only allow admins to conduct this action
    const role = await this.plyr.getRole(gameId, userId);
    if (role !== PlayerRole.ADMIN) {
      throw new PlayerRoleUnauthorizedException(userId, role);
    }

    const player = await this.plyr.findById(playerId);

    // Make sure the player is alive
    if (player.status !== PlayerStatus.ALIVE && player.status !== PlayerStatus.SAFE) {
      throw new PlayerStatusNotValidException(playerId, player.status);
    }

    player.status = player.status === PlayerStatus.ALIVE ? PlayerStatus.SAFE : PlayerStatus.ALIVE;
    player.save();
  }

  async fetchTargets(userId: MongoId, gameId: MongoId) {
    // Only allow admins to conduct this action
    const role = await this.plyr.getRole(gameId, userId);
    if (role !== PlayerRole.ADMIN) {
        throw new PlayerRoleUnauthorizedException(userId, role);
    }

    const players: { [key: string]: Player } = {};
    (await this.plyr.findByGame(gameId)).forEach(
        (player) => (players[player.id] = player)
    );

    // Map player IDs to user details for quick lookup
    const userIds = Object.values(players).map((p) => p.userId);
    const users: { [key: string]: User } = {};
    (await this.usr.findByIds(userIds)).forEach(
        (user) => (users[user.id] = user)
    );

    const playersToUsers: { [key: string]: User } = {};
    Object.values(players).forEach((p) => {
        playersToUsers[p.id] = users[p.userId.toString()];
    });

    // Retrieve all target assignments for the game
    const allTargets = await this.model.find({ gameId: gameId }).exec();

    const data = [];
    allTargets.forEach((t) => {
        const fromPlayer = playersToUsers[t.playerId.toString()];
        const targetPlayer = playersToUsers[t.targetId.toString()];

        const targetId = t.id;
        
        data.push({
            fromName: `${fromPlayer.firstName} ${fromPlayer.surname}`,
            toName: `${targetPlayer.firstName} ${targetPlayer.surname}`,
            targetId,
            status: t.status
        });
    });

    return data;
}



  async fetchLeaderboard(gameId: MongoId) {
    const game = await this.gme.findById(gameId);
    const players: { [key: string]: Player } = {};

    (await this.plyr.findByGame(gameId)).forEach(
      (player) => (players[player.id] = player),
    );
    const playerIds = Object.keys(players).map((pid) => new MongoId(pid));

    // Get all users associated with these players
    const userIds = Object.values(players).map((p) => p.userId);
    const users: { [key: string]: User } = {};
    (await this.usr.findByIds(userIds)).forEach(
      (user) => (users[user.id] = user),
    );

    // Grab the number of kills for each player
    const countObjects = await this.model
      .aggregate([
        {
          $match: {
            status: 'COMPLETE',
            playerId: { $in: playerIds },
          },
        },
        {
          $group: {
            _id: '$playerId',
            count: {
              $sum: 1,
            },
            killed: {
              $push: '$targetId',
            },
          },
        },
      ])
      .exec();

    const killCounts: { [key: string]: number } = {};
    countObjects.forEach((doc) => {
      killCounts[doc._id.toString()] = doc.count;
    });

    const killers: { [key: string]: string } = {};
    countObjects.forEach((doc) => {
      if (doc.killed) {
        doc.killed.forEach((killedId) => {
          killers[killedId.toString()] = doc._id.toString();
        });
      }
    });

    const allInfo: LeaderboardPlayerInfo[] = [];
    Object.values(players).forEach((p) => {
      const user = users[p.userId.toString()];
      const killer = killers[p.id]
        ? users[players[killers[p.id]].userId.toString()]
        : undefined;
      const info: LeaderboardPlayerInfo = {
        playerId: p.id,
        userId: p.userId.toString(),
        teamPartnerId: p.teamPartnerId ? p.teamPartnerId.toString() : '',
        name: `${user.firstName} ${user.surname}`,
        kills: killCounts[p.id] ?? 0,
        alive: p.status === PlayerStatus.ALIVE,
        safe: p.status === PlayerStatus.SAFE,
        killedBy: killer ? `${killer.firstName} ${killer.surname}` : undefined,
      };

      allInfo.push(info);
    });

    return allInfo;
  }
}
