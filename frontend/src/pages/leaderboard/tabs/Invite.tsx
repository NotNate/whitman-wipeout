import { useEffect, useState, useCallback } from "react";
import { Avatar, Badge, Button, Card, Box, HStack, Stack, Text, Flex, Spinner, useToast } from "@chakra-ui/react";
import { 
  inviteTeam, 
  getInvites, 
  getInvitedBy, 
  getAllPlayersInfo, 
  acceptInvite, 
  rejectInvite,
  getCurrentPlayerInfo // Newly added
} from "api/game/player";
import { LeaderboardPlayerInfo } from "shared/api/game/player";
import { GameInfo } from "shared/api/game";
import MultiButton from "components/MultiButton";

function Invite({ gameInfo }: { gameInfo: GameInfo }) {
  const [players, setPlayers] = useState<LeaderboardPlayerInfo[]>([]);
  const [invites, setInvites] = useState<string[]>([]);
  const [invitedBy, setInvitedBy] = useState<string[]>([]);
  const [hasPartner, setHasPartner] = useState<boolean>(false);
  const [partnerName, setPartnerName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const toast = useToast();

  // Function to load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all necessary data concurrently
      const [allPlayers, inviteList, invitedByList, currentPlayerInfo] = await Promise.all([
        getAllPlayersInfo(gameInfo.gameId),
        getInvites(gameInfo.gameId),
        getInvitedBy(gameInfo.gameId),
        getCurrentPlayerInfo(gameInfo.gameId),
      ]);

      console.log("All Players:", allPlayers);
      console.log("Invites:", inviteList);
      console.log("Invited By:", invitedByList);
      console.log("Current Player Info:", currentPlayerInfo);

      if (currentPlayerInfo.hasPartner && currentPlayerInfo.partnerName) {
        setHasPartner(true);
        setPartnerName(currentPlayerInfo.partnerName);
        setPlayers([]); // Clear players list since user has a partner
      } else {
        setHasPartner(false);
        setPartnerName('');
        // Filter players to only those without a teamPartnerId
        const availablePlayers = allPlayers.filter(player => !player.teamPartnerId);
        setPlayers(availablePlayers);
      }

      setInvites(inviteList); // Already strings
      setInvitedBy(invitedByList); // Already strings
    } catch (error) {
      console.error('Failed to load invite data:', error);
      // Optionally, handle error state here (e.g., show a toast notification)
    } finally {
      setLoading(false);
    }
  }, [gameInfo.gameId]);

  // Load data on component mount and when gameId changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler for inviting a player
  const handleInvite = async (playerId: string) => {
    try {
      await inviteTeam(gameInfo.gameId, playerId);
      await loadData();
      toast({
        title: "Invite Sent",
        description: "You have successfully invited the player.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error(`Failed to invite player ${playerId}:`, error);
      toast({
        title: "Invite Failed",
        description: "There was an error sending the invite.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };


  // Handler for accepting an invite
  const handleAccept = async (inviterUserId: string) => {
    try {
      await acceptInvite(gameInfo.gameId, inviterUserId);
      await loadData();
      toast({
        title: "Invite Accepted",
        description: "You have successfully accepted the invite.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error(`Failed to accept invite from ${inviterUserId}:`, error);
      toast({
        title: "Accept Failed",
        description: "There was an error accepting the invite.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Handler for rejecting an invite
  const handleReject = async (inviterUserId: string) => {
    try {
      await rejectInvite(gameInfo.gameId, inviterUserId);
      await loadData();
      toast({
        title: "Invite Rejected",
        description: "You have successfully rejected the invite.",
        status: "info",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error(`Failed to reject invite from ${inviterUserId}:`, error);
      toast({
        title: "Reject Failed",
        description: "There was an error rejecting the invite.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Display a loading spinner while data is being fetched
  if (loading) {
    return (
      <Flex align="center" justify="center" height="100vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  // If user has a partner, display the message
  if (hasPartner) {
    return (
      <Flex align="center" justify="center" height="100vh">
        <Text fontSize="2xl" fontWeight="bold">
          You already have a partner: {partnerName}
        </Text>
      </Flex>
    );
  }

  // Else, display the invite list
  return (
    <Stack alignItems="center" width="100%" padding={4}>
      <Text fontSize="2xl" fontWeight="bold">Invite Players</Text>
      {players.length === 0 ? (
        <Text>No players available to invite.</Text>
      ) : (
        players.map((player) => (
          <InviteItem
            key={player.playerId}
            player={player}
            invites={invites}
            invitedBy={invitedBy}
            onInvite={handleInvite}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        ))
      )}
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
            <MultiButton
              onActivate={handleAcceptClick}
              clicksRequired={5}
              colorScheme="green"
              variant="solid"
              isLoading={loading}
            >
              Accept
            </MultiButton>
            <MultiButton
              onActivate={handleRejectClick}
              clicksRequired={5}
              colorScheme="red"
              variant="solid"
              isLoading={loading}
            >
              Reject
            </MultiButton>
          </Flex>
        )}
      </HStack>
    </Card>
  );
}

export default Invite;
