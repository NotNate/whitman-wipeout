import { useEffect, useState } from "react";
import { Avatar, Badge, Box, Button, Card, HStack, Stack, Text } from "@chakra-ui/react";
import { inviteTeam, getInvites, getInvitedBy, getAllPlayersInfo } from "api/game/player";
import { LeaderboardPlayerInfo } from "shared/api/game/player";
import { GameInfo } from "shared/api/game";

function Invite({ gameInfo }: { gameInfo: GameInfo }) {
  const [players, setPlayers] = useState<LeaderboardPlayerInfo[]>([]);
  const [invites, setInvites] = useState<string[]>([]);
  const [invitedBy, setInvitedBy] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [allPlayers, inviteList, invitedByList] = await Promise.all([
          getAllPlayersInfo(gameInfo.gameId),
          getInvites(gameInfo.gameId),
          getInvitedBy(gameInfo.gameId),
        ]);

        setPlayers(allPlayers);
        setInvites(inviteList.map((id: string) => id.toString()));
        setInvitedBy(invitedByList.map((id: string) => id.toString()));
      } catch (error) {
        console.error('Failed to load invite data:', error);
        // Optionally, handle error state here
      }
    };

    loadData();
  }, [gameInfo.gameId]);

  const handleInvite = async (playerId: string) => {
    try {
      await inviteTeam(gameInfo.gameId, playerId);
      // After inviting, re-fetch the invites
      const updatedInvites = await getInvites(gameInfo.gameId);
      setInvites(updatedInvites.map((id: string) => id.toString()));
    } catch (error) {
      console.error(`Failed to invite player ${playerId}:`, error);
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
  onInvite: (playerId: string) => Promise<void>; // Update the type
}) {
  const [loading, setLoading] = useState(false);
  const isAlreadyInvited = invites.includes(player.userId);
  const hasInvitedByRequester = invitedBy.includes(player.userId);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onInvite(player.playerId);
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
            {(isAlreadyInvited || hasInvitedByRequester) && (
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
          {isAlreadyInvited || hasInvitedByRequester ? "Invited" : "Invite"}
        </Button>
      </HStack>
    </Card>
  );
}

export default Invite;
