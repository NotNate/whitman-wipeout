import { authPost } from "../../utils/http";

/**
 * Register a player for the given game
 */
export const register = async (gameId: string) => {
  await authPost(`/game/player/register?gameId=${gameId}`);
};

/**
 * Invite a player to be your team partner
 */
export const inviteTeam = async (gameId: string, teamPartnerId: string) => {
  await authPost(`/game/player/inviteTeam?gameId=${gameId}&teamPartnerId=${teamPartnerId}`);
};

/**
 * Get the list of players invited by the current player
 */
export const getInvites = async (gameId: string): Promise<string[]> => {
  const response = await authPost(`/game/player/getInvites?gameId=${gameId}`);
  return response.data as string[];
};

/**
 * Get the list of players who have invited the current player
 */
export const getInvitedBy = async (gameId: string): Promise<string[]> => {
  const response = await authPost(`/game/player/getInvitedBy?gameId=${gameId}`);
  return response.data as string[];
};
