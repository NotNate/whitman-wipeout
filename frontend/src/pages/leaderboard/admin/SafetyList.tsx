import { useCallback, useEffect, useState } from "react";
import { Card, HStack, Stack, Text } from "@chakra-ui/react";

// API
import { fetchLeaderboard, makePlayerSafe } from "api/game/target";
import { LeaderboardPlayerInfo } from "shared/api/game/player";

// Components
import MultiButton from "components/MultiButton";

/**
 * Page designed only for admins of games, displaying all players (alive or safe),
 * and allows for making them safe
 */
function SafetyList() {
  const [data, setData] = useState<LeaderboardPlayerInfo[]>([]);

  const grabPlayers = useCallback(async () => {
    const leaderboardData = await fetchLeaderboard();
    setData(
      leaderboardData.filter((player) => player.alive || player.safe)
    );
  }, []);

  // Grab players on initial load
  useEffect(() => {
    grabPlayers();
  }, [grabPlayers]);

  return (
    <Stack alignItems="center" width="100%">
      <Card
        variant="outline"
        boxShadow={"lg"}
        width="90%"
        minWidth="400px"
        padding={4}
        backgroundColor="blue.100"
        display="flex"
        alignItems="center"
      >
        <Text fontWeight="extrabold">WARNING</Text>
        <Text fontWeight="normal" align="center">
          The controls on this page are meant for admins only, and can seriously
          alter the course of the game if used incorrectly. All buttons on this
          page require multiple, repeated clicks in order to activate their
          function (indicated by the number in parentheses). This prevents fat
          fingers. Don't be stupid.
        </Text>
      </Card>
      <Stack padding={4} alignItems="center" width="100%">
        {data.length !== 0 ? (
          data.map((playerInfo) => (
            <PlayerItem
              key={playerInfo.playerId}
              info={playerInfo}
              grabPlayers={grabPlayers}
            />
          ))
        ) : (
          <Card
            variant="outline"
            boxShadow={"lg"}
            width="60%"
            minWidth="300px"
            padding={4}
            backgroundColor="yellow.100"
            display="flex"
            alignItems="center"
          >
            <Text fontWeight="extrabold">NOTE</Text>
            <Text fontWeight="normal" align="center">
              There are no players alive or safe!
            </Text>
          </Card>
        )}
      </Stack>
    </Stack>
  );
}

function PlayerItem({
  info,
  grabPlayers,
}: {
  info: LeaderboardPlayerInfo;
  grabPlayers: () => void;
}) {
  const [loading, setLoading] = useState(false);
  let color = "white";
  if (info.alive) {
    color = "green.100";
  } else if (info.safe) {
    color = "blue.100";
  }

  return (
    <Card
      variant="outline"
      boxShadow={"lg"}
      width="70%"
      minWidth="400px"
      key={info.playerId}
      sx={{ backgroundColor: color }}
    >
      <HStack padding={4}>
        <Stack>
          <Text>
            {info.name}
          </Text>
          <Text mt="-6px" fontWeight="bold">
            Status: {info.alive ? "Alive" : info.safe ? "Safe" : "Unknown"}
          </Text>
        </Stack>
        <MultiButton
          onActivate={async () => {
            setLoading(true);
            await makePlayerSafe(info.playerId);
            await grabPlayers();
            setLoading(false);
          }}
          clicksRequired={3}
          isDisabled={loading}
          ml="auto"
        >
          {info.safe ? "Make Unsafe" : "Make Safe"}
        </MultiButton>
      </HStack>
    </Card>
  );
}

export default SafetyList;
