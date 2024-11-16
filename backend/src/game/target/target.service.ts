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
import { TargetTeamInfo } from 'shared/api/game/target';
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
  
    if (!query || query.length === 0) {
      throw new TargetNotFoundException(playerId);
    }
    return query[0];
  }  

  async findByGameAndUser(gameId: MongoId, userId: MongoId): Promise<Target> {
    const player = await this.plyr.find(userId, gameId);
    const playerId = new MongoId(player.id);
    return await this.findByGameAndPlayer(gameId, playerId);
  }

  async fetchTarget(gameId: MongoId, userId: MongoId): Promise<TargetTeamInfo> {
    const player = await this.plyr.find(userId, gameId);
    const playerId = new MongoId(player.id);
  
    const game = await this.gme.findById(player.gameId);
  
    if (player.status !== PlayerStatus.ALIVE && player.status !== PlayerStatus.SAFE) {
      throw new PlayerStatusNotValidException(playerId, player.status);
    }
  
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new GameStatusNotValidException(player.gameId, game.status);
    }
  
    let target: Target;
    try {
      target = await this.findByGameAndPlayer(player.gameId, playerId);
    } catch (e) {
      if (e instanceof TargetNotFoundException) {
        // Return an empty or special response indicating no target
        return {
          members: [],
        };
      } else {
        throw e; // Re-throw other exceptions
      }
    }
  
    const targetPlayer = await this.plyr.findById(target.targetId);
    const targetUser = await this.usr.findById(targetPlayer.userId);
  
    // Fetch the target player's partner
    let targetPartnerInfo = null;
    if (targetPlayer.teamPartnerId) {
      const targetPartner = await this.plyr.findById(targetPlayer.teamPartnerId);
      const targetPartnerUser = await this.usr.findById(targetPartner.userId);
      targetPartnerInfo = {
        name: `${targetPartnerUser.firstName} ${targetPartnerUser.surname}`,
        safe: targetPartner.status === PlayerStatus.SAFE,
        status: targetPartner.status,
      };
    }
  
    return {
      members: [
        {
          name: `${targetUser.firstName} ${targetUser.surname}`,
          safe: targetPlayer.status === PlayerStatus.SAFE,
          status: targetPlayer.status,
        },
        ...(targetPartnerInfo ? [targetPartnerInfo] : []),
      ],
    };
  }

  /**
   * Create targets for all alive players in a game. Expire all pending targets,
   * deactivating them.
   * @param gameId The game in question
   * @param userId The user to register for the game in question
   */
  async matchPlayers(userId: MongoId, gameId: MongoId) {
    const game = await this.gme.findById(gameId);
  
    // Only allow admins to conduct this action
    const role = await this.plyr.getRole(gameId, userId);
    if (role !== PlayerRole.ADMIN) {
      throw new PlayerRoleUnauthorizedException(userId, role);
    }
  
    // Get all players who are alive or safe
    const players = await this.plyr.findByGameAndStatus(gameId, [
      PlayerStatus.ALIVE,
      PlayerStatus.SAFE,
    ]);
  
    // Create a map for quick lookup of alive players
    const playerMap = new Map<string, Player>();
    players.forEach(player => playerMap.set(player.id.toString(), player));
  
    // Initialize list to hold valid teams
    const validTeams: string[][] = [];
    const grouped = new Set<string>();
  
    players.forEach(player => {
      const playerIdStr = player.id.toString();
  
      if (grouped.has(playerIdStr)) {
        return; // Player already grouped
      }
  
      if (player.teamPartnerId) {
        const partnerIdStr = player.teamPartnerId.toString();
        if (playerMap.has(partnerIdStr)) {
          // Partner is alive, form a team of two
          validTeams.push([playerIdStr, partnerIdStr]);
          grouped.add(playerIdStr);
          grouped.add(partnerIdStr);
        } else {
          // Partner is dead, treat as a single player
          validTeams.push([playerIdStr]);
          grouped.add(playerIdStr);
        }
      } else {
        // Player has no team partner, treat as a single player
        validTeams.push([playerIdStr]);
        grouped.add(playerIdStr);
      }
    });
  
    // Shuffle the valid teams
    const shuffledTeams = shuffle(validTeams);
  
    const targetDocuments: TargetDocument[] = [];
  
    // Assign each team a target team in a circular manner
    for (let i = 0; i < shuffledTeams.length; i++) {
      const currentTeam = shuffledTeams[i];
      const targetTeam = shuffledTeams[(i + 1) % shuffledTeams.length];
  
      // Assign each member of the current team to target each member of the target team
      for (const playerId of currentTeam) {
        for (const targetId of targetTeam) {
          const target = new this.model();
          target.gameId = gameId;
          target.playerId = new MongoId(playerId);
          target.targetId = new MongoId(targetId);
          targetDocuments.push(target);
        }
      }
    }
  
    // Expire all pending targets for this game
    await this.model.updateMany(
      { gameId: gameId, status: TargetStatus.PENDING },
      { $set: { status: TargetStatus.EXPIRED } }
    ).exec();
  
    // Insert new target assignments
    await this.model.insertMany(targetDocuments);
  
    // Update the game status to IN_PROGRESS if not already set
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
    await killed.save(); // Save the killed player's status

    // Mark the current target as COMPLETE
    target.status = TargetStatus.COMPLETE;
    await target.save(); // Save the updated target assignment

    // Expire all target assignments pointing to the killed player
    await this.model.updateMany(
      { targetId: killed.id, status: TargetStatus.PENDING },
      { $set: { status: TargetStatus.EXPIRED } }
    ).exec();

    // Expire all the target assignments of the killed player
    await this.model.updateMany(
      { playerId: killed.id, status: TargetStatus.PENDING },
      { $set: { status: TargetStatus.EXPIRED } }
    ).exec();

    // Expire the partner's target on the killed player, if applicable
    if (killedPartnerId) {
      const partnerTarget = await this.findByGameAndPlayerAndTarget(gameId, killedPartnerId, killedId);
      if (partnerTarget) {
        partnerTarget.status = TargetStatus.EXPIRED;
        await partnerTarget.save(); // Save the expired partner target
      }
    }

    // Check if the entire opposing team is eliminated
    let isEntireTeamEliminated = false;
    if (killedPartnerId) {
      const killedPartner = await this.plyr.findById(killedPartnerId);
      if (killedPartner && killedPartner.status === PlayerStatus.KILLED) {
        isEntireTeamEliminated = true;
      }
    }

    if (isEntireTeamEliminated) {
      // Identify the eliminated team
      const eliminatedTeamIds: MongoId[] = [killed.id];
      if (killedPartnerId) {
        eliminatedTeamIds.push(killedPartnerId);
      }
  
      // Fetch the eliminated team's current target
      const eliminatedTeamTarget = await this.model.findOne({
        gameId: gameId,
        playerId: { $in: eliminatedTeamIds },
        status: TargetStatus.PENDING,
      }).exec();
  
      const killingTeamIds: MongoId[] = [playerId];
      if (playerPartnerId) {
        killingTeamIds.push(playerPartnerId);
      }
  
      if (eliminatedTeamTarget) {
        const newTargetId = eliminatedTeamTarget.targetId;
  
        // Assign the killing team to target the eliminated team's target
        const newTargetAssignments: TargetDocument[] = [];
  
        for (const killerId of killingTeamIds) {
          // Remove existing pending targets for the killing team
          await this.model.deleteMany({
            gameId: gameId,
            playerId: killerId,
            status: TargetStatus.PENDING,
          }).exec();
  
          // Create new target assignment
          const newTarget = new this.model();
          newTarget.gameId = gameId;
          newTarget.playerId = killerId;
          newTarget.targetId = newTargetId;
          newTarget.status = TargetStatus.PENDING;
          newTargetAssignments.push(newTarget);
        }
  
        // Insert new target assignments
        await this.model.insertMany(newTargetAssignments);
      } else {
        // Handle the case where the eliminated team has no target
        // This could mean the killing team is now the last team
        // Check if the killing team is the last team remaining
        const alivePlayers = await this.plyr.findByGameAndStatus(gameId, [PlayerStatus.ALIVE]);
  
        const aliveTeams = new Set<string>();
        for (const p of alivePlayers) {
          const teamId = p.teamPartnerId ? p.teamPartnerId.toString() : p.id.toString();
          aliveTeams.add(teamId);
        }
  
        // if (aliveTeams.size === 1) {
        //   // The killing team is the only team left. The game is over.
        //   game.status = GameStatus.FINISHED;
        //   await game.save();
  
        //   // Optionally, notify players or perform end-of-game logic
        // }
      }
  
      await this.model.updateMany(
        {
          gameId: gameId,
          playerId: { $in: eliminatedTeamIds },
          status: { $in: [TargetStatus.PENDING, TargetStatus.COMPLETE] },
        },
        { $set: { status: TargetStatus.EXPIRED } }
      ).exec();
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
