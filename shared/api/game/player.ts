export type LeaderboardPlayerInfo = {
  playerId: string;
  userId: string;
  teamPartnerId: string;
  name: string;
  kills: number;
  alive: boolean;
  safe: boolean;

  // Name of the killer
  killedBy?: string;
};
