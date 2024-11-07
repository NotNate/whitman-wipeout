export type LeaderboardPlayerInfo = {
  playerId: string;
  teamParterId: string;
  name: string;
  kills: number;
  alive: boolean;
  safe: boolean;

  // Name of the killer
  killedBy?: string;
};
