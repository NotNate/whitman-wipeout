export type LeaderboardPlayerInfo = {
  playerId: string;
  name: string;
  kills: number;
  alive: boolean;
  safe: boolean;

  // Name of the killer
  killedBy?: string;
};
