import { useEffect, useState } from "react";
import { Avatar, Badge, Button, Card, HStack, Stack, Text, Flex } from "@chakra-ui/react";
import { inviteTeam, getInvites, getInvitedBy, getAllPlayersInfo, acceptInvite, rejectInvite } from "api/game/player";
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

        console.log("All Players:", allPlayers);
        console.log("Invites:", inviteList);
        console.log("Invited By:", invitedByList);

        setPlayers(allPlayers);
        setInvites(inviteList); // Already strings
        setInvitedBy(invitedByList); // Already strings
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
      setInvites(updatedInvites);
      console.log("Updated Invites:", updatedInvites);
    } catch (error) {
      console.error(`Failed to invite player ${playerId}:`, error);
      // Optionally, you can add error state and display a message to the user
    }
  };

  const handleAccept = async (inviterUserId: string) => {
    try {
      await acceptInvite(gameInfo.gameId, inviterUserId);
      // After accepting, re-fetch the invites and invitedBy
      const [updatedInvites, updatedInvitedBy] = await Promise.all([
        getInvites(gameInfo.gameId),
        getInvitedBy(gameInfo.gameId),
      ]);
      setInvites(updatedInvites);
      setInvitedBy(updatedInvitedBy);
      console.log("Accepted invite from:", inviterUserId);
    } catch (error) {
      console.error(`Failed to accept invite from ${inviterUserId}:`, error);
      // Optionally, handle error state here
    }
  };

  const handleReject = async (inviterUserId: string) => {
    try {
      await rejectInvite(gameInfo.gameId, inviterUserId);
      // After rejecting, re-fetch the invites and invitedBy
      const [updatedInvites, updatedInvitedBy] = await Promise.all([
        getInvites(gameInfo.gameId),
        getInvitedBy(gameInfo.gameId),
      ]);
      setInvites(updatedInvites);
      setInvitedBy(updatedInvitedBy);
      console.log("Rejected invite from:", inviterUserId);
    } catch (error) {
      console.error(`Failed to reject invite from ${inviterUserId}:`, error);
      // Optionally, handle error state here
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
          onAccept={handleAccept}
          onReject={handleReject}
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
  onAccept,
  onReject,
}: {
  player: LeaderboardPlayerInfo;
  invites: string[];
  invitedBy: string[];
  onInvite: (playerId: string) => Promise<void>;
  onAccept: (inviterUserId: string) => Promise<void>;
  onReject: (inviterUserId: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  
  // Determine if the current user has been invited by this player
  const isInvitedByThisPlayer = invitedBy.includes(player.userId);
  
  // Determine if the current user has already invited this player
  const isAlreadyInvited = invites.includes(player.userId);

  const handleInviteClick = async () => {
    setLoading(true);
    try {
      await onInvite(player.playerId);
    } catch (error) {
      console.error(`Failed to invite player ${player.playerId}:`, error);
      // Optionally, handle error state here
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptClick = async () => {
    setLoading(true);
    try {
      await onAccept(player.userId);
    } catch (error) {
      console.error(`Failed to accept invite from ${player.userId}:`, error);
      // Optionally, handle error state here
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClick = async () => {
    setLoading(true);
    try {
      await onReject(player.userId);
    } catch (error) {
      console.error(`Failed to reject invite from ${player.userId}:`, error);
      // Optionally, handle error state here
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
      bg="gray.100"
    >
      <HStack padding={4} justifyContent="space-between">
        <HStack>
          <Avatar name={player.name} />
          <Stack>
            <Text fontWeight="bold">{player.name}</Text>
            {/* Optionally, display additional info like kills, status, etc. */}
            {(isAlreadyInvited || isInvitedByThisPlayer) && (
              <Badge colorScheme="blue">Already Invited</Badge>
            )}
          </Stack>
        </HStack>
        {!isInvitedByThisPlayer ? (
          <Button
            onClick={handleInviteClick}
            isDisabled={isAlreadyInvited || loading}
            isLoading={loading}
            colorScheme="blue"
            variant="solid"
          >
            {isAlreadyInvited ? "Invited" : "Invite"}
          </Button>
        ) : (
          <Flex gap={2}>
            <Button
              onClick={handleAcceptClick}
              isLoading={loading}
              colorScheme="green"
              variant="solid"
            >
              Accept
            </Button>
            <Button
              onClick={handleRejectClick}
              isLoading={loading}
              colorScheme="red"
              variant="solid"
            >
              Reject
            </Button>
          </Flex>
        )}
      </HStack>
    </Card>
  );
}

export default Invite;
