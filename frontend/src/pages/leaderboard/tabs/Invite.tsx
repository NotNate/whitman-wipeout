import { useEffect, useState } from "react";
import { Avatar, Badge, Box, Button, Card, HStack, Stack, Text } from "@chakra-ui/react";
import { inviteTeam, getInvites, getInvitedBy } from "api/game/player";
import { fetchLeaderboard } from "api/game/target";
import { LeaderboardPlayerInfo } from "shared/api/game/player";
import { GameInfo } from "shared/api/game";

function Invite({ gameInfo }: { gameInfo: GameInfo }) {
  const [players, setPlayers] = useState<LeaderboardPlayerInfo[]>([]);
  const [invites, setInvites] = useState<string[]>([]);
  const [invitedBy, setInvitedBy] = useState<string[]>([]);

  useEffect(() => {
    const loadPlayers = async () => {
      const allPlayers = await fetchLeaderboard(); // Fetch all players in the game
      const filteredPlayers = allPlayers.filter(
        (player) => !player.teamPartnerId || player.teamPartnerId === '' // Exclude players who already have a partner
      );
      setPlayers(filteredPlayers);
    };

    const loadInvites = async () => {
      const inviteList = await getInvites(gameInfo.gameId);
      setInvites(inviteList.map((id: string) => id.toString()));
    };

    const loadInvitedBy = async () => {
      const invitedByList = await getInvitedBy(gameInfo.gameId);
      setInvitedBy(invitedByList.map((id: string) => id.toString()));
    };

    loadPlayers();
    loadInvites();
    loadInvitedBy();
  }, [gameInfo.gameId]);

  const handleInvite = async (userId: string) => { // Change parameter name to userId
    try {
      await inviteTeam(gameInfo.gameId, userId); // Pass userId instead of playerId
      setInvites((prevInvites) => [...prevInvites, userId]);
    } catch (error) {
      console.error(`Failed to invite user ${userId}:`, error);
      // Optionally, you can add error state and display a message to the user
    }
  };

  return (
    <Stack alignItems="center" width="100%" padding={4}>
      <Text fontSize="2xl" fontWeight="bold">Invite Players</Text>
      {players.map((player) => (
        <InviteItem
          key={player.playerId}
          player={player}
          invites={invites}
          invitedBy={invitedBy}
          onInvite={handleInvite}
        />
      ))}
    </Stack>
  );
}

function InviteItem({
  player,
  invites,
  invitedBy,
  onInvite,
}: {
  player: LeaderboardPlayerInfo;
  invites: string[];
  invitedBy: string[];
  onInvite: (userId: string) => Promise<void>; // Update type to return Promise
}) {
  const [loading, setLoading] = useState(false);
  const isAlreadyInvited = invites.includes(player.userId);
  const hasInvitedByRequester = invitedBy.includes(player.userId);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onInvite(player.userId);
    } catch (error) {
      // Handle error if needed
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      variant="outline"
      boxShadow="lg"
      width="70%"
      minWidth="400px"
      sx={{ backgroundColor: "gray.100" }}
    >
      <HStack padding={4} justifyContent="space-between">
        <HStack>
          <Avatar name={player.name} />
          <Stack>
            <Text fontWeight="bold">{player.name}</Text>
            {hasInvitedByRequester && (
              <Badge colorScheme="blue">Already Invited</Badge>
            )}
          </Stack>
        </HStack>
        <Button
          onClick={handleClick}
          isDisabled={isAlreadyInvited || hasInvitedByRequester || loading}
          isLoading={loading}
          colorScheme="blue"
          variant="solid"
        >
          {isAlreadyInvited ? "Invited" : "Invite"}
        </Button>
      </HStack>
    </Card>
  );
}

export default Invite;
