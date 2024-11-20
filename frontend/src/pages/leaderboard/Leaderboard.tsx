import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  Avatar,
  Badge,
  Box,
  Card,
  Flex,
  HStack,
  VStack,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";

// State
import { useRecoilValue } from "recoil";
import { gameInfoAtom } from "global/user-state";

// API
import { fetchLeaderboard } from "api/game/target";
import { LeaderboardPlayerInfo } from "shared/api/game/player";

// Components
import { EventCountdown } from "components/Countdown";

// Tabs
import AllTargets from "./admin/AllTargets";
import TargetAssignment from "./tabs/TargetAssignment";
import Rules from "./tabs/Rules";
import SafetyList from "./admin/SafetyList";
import { GameInfo } from "shared/api/game";
import Invite from "./tabs/Invite";

/**
 * The main page for the application. Displays the leaderboard and all relevant
 * tabs.
 */
function Leaderboard() {
  const navigate = useNavigate();
  const gameInfo = useRecoilValue(gameInfoAtom);

  useEffect(() => {
    // Only use this if the user ID is not null
    // TODO: Remove this so unregistered users can view the leaderboard
    if (gameInfo === undefined || gameInfo.role === "NONE") {
      navigate("/app/register");
      return;
    }
  }, [gameInfo, navigate]);

  if (gameInfo === undefined) {
    return null;
  }

  // List of all tabs for admins
  const adminTabs = (
    <Tabs variant="soft-rounded" colorScheme="green" isFitted>
      <TabList>
        <Tab>Leaderboard</Tab>
        <Tab>All Targets</Tab>
        <Tab>Safety List</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <LeaderboardList gameInfo={gameInfo} />
        </TabPanel>
        <TabPanel>
          <AllTargets />
        </TabPanel>
        <TabPanel>
          <Stack alignItems="center" width="100%">
            <SafetyList />
          </Stack>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );

  // List of all tabs for the player
  const playerTabs = (
    <Tabs variant="soft-rounded" colorScheme="blue" isFitted>
      <TabList>
        <Tab>Leaderboard</Tab>
        <Tab>Your Goal</Tab>
        <Tab>Invites</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <LeaderboardList gameInfo={gameInfo} />
        </TabPanel>
        <TabPanel>
          <Stack alignItems="center" width="100%">
            <TargetAssignment />
          </Stack>
        </TabPanel>
        <TabPanel>
          <Stack alignItems="center" width="100%">
            {gameInfo && <Invite gameInfo={gameInfo} />}
          </Stack>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );

  // NOTE: There are two different sets of tabs (one for admins and one for players)
  return (
    <Box m={[2, 4]} px={[2, 4]} py={[4, 6]}>
      {gameInfo?.role === "ADMIN" ? adminTabs : playerTabs}
    </Box>
  );
}

function LeaderboardList({ gameInfo }: { gameInfo: GameInfo }) {
  const [data, setData] = useState<LeaderboardPlayerInfo[]>([]);

  useEffect(() => {
    /* Grab user information on the leaderboard, make sure alive players are
    listed first, and then sort by kills. */
    const fetchData = async () => {
      const leaderboardData = await fetchLeaderboard(gameInfo.id); // Ensure fetchLeaderboard accepts gameId
      setData(
        leaderboardData.sort((a, b) => {
          if (a.alive === b.alive) {
            return b.kills - a.kills;
          } else {
            if (a.alive) return -1;
            return 1;
          }
        })
      );
    };
    fetchData();
  }, [gameInfo.id]);

  // Group players by team
  const groupByTeams = (players: LeaderboardPlayerInfo[]) => {
    const teamsMap: { [key: string]: LeaderboardPlayerInfo[] } = {};

    players.forEach((player) => {
      if (player.teamPartnerId) {
        // Create a unique team key by sorting playerId and teamPartnerId
        const teamIds = [player.playerId, player.teamPartnerId].sort();
        const teamKey = teamIds.join("-");

        if (!teamsMap[teamKey]) {
          teamsMap[teamKey] = [];
        }
        teamsMap[teamKey].push(player);
      } else {
        // Solo player
        const teamKey = player.playerId; // unique key for solo player
        if (!teamsMap[teamKey]) {
          teamsMap[teamKey] = [];
        }
        teamsMap[teamKey].push(player);
      }
    });

    // Convert the map to an array of teams
    const teams = Object.values(teamsMap).filter((team) => team.length > 0);
    return teams;
  };

  // Prepare team data with adjusted kills and alive members
  const teams = groupByTeams(data).map((team) => {
    const teamKills = team.reduce((sum, player) => sum + player.kills, 0);
    const teamRevives = team.reduce((sum, player) => sum + player.revives, 0);
    const adjustedTeamKills = teamKills - teamRevives;
    
    // Calculate the number of alive members
    const aliveMembers = team.reduce((count, player) => {
      return (player.alive || player.safe) ? count + 1 : count;
    }, 0);
    
    return { teamPlayers: team, teamKills, teamRevives, adjustedTeamKills, aliveMembers };
  });

  // Sort teams primarily by adjustedTeamKills descending, then by aliveMembers descending
  const sortedTeams = teams.sort((a, b) => {
    if (b.adjustedTeamKills !== a.adjustedTeamKills) {
      return b.adjustedTeamKills - a.adjustedTeamKills;
    }
    return b.aliveMembers - a.aliveMembers;
  });

  // Determine layout direction based on screen size
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <VStack alignItems="center" width="100%" spacing={[4, 6]}>
      {gameInfo && <EventCountdown gameInfo={gameInfo} />}
      <VStack padding={[2, 4]} alignItems="center" width="100%" spacing={[4, 6]}>
        {sortedTeams.map((team, index) => (
          <TeamLeaderboardItem
            key={team.teamPlayers.map((p) => p.playerId).join("-")}
            team={team}
            ranking={index + 1}
          />
        ))}
      </VStack>
    </VStack>
  );
}

function TeamLeaderboardItem({
  team,
  ranking,
}: {
  team: {
    teamPlayers: LeaderboardPlayerInfo[];
    teamKills: number;
    teamRevives: number;
    adjustedTeamKills: number;
    aliveMembers: number;
  };
  ranking: number;
}) {
  const isSolo = team.teamPlayers.length === 1;

  return (
    <Card
      variant="outline"
      boxShadow={"lg"}
      width={["95%", "80%"]}
      minWidth={["auto", "500px"]}
      padding={[3, 4]}
      mb={[2, 4]}
      bg={isSolo ? "yellow.50" : "gray.50"}
      borderColor={isSolo ? "yellow.300" : "gray.200"}
    >
      <VStack width="100%" alignItems="start" spacing={[2, 4]}>
        {/* Team Header */}
        <Flex
          direction={["column", "row"]}
          justifyContent="space-between"
          alignItems={["flex-start", "center"]}
          width="100%"
        >
          <Text fontSize={["md", "lg"]} fontWeight="bold">
            {ranking}: Team Splash Points: {team.adjustedTeamKills}
          </Text>
          {/* Optional: Add a team badge or other team-level indicators here */}
        </Flex>
        {/* Solo Player Indicator */}
        {isSolo && (
          <Text fontStyle="italic" color="gray.600" mb={[2, 0]}>
            Waiting for partner
          </Text>
        )}

        {/* Individual Team Members */}
        <VStack spacing={[2, 4]} width="100%">
          {team.teamPlayers.map((player, index) => (
            <LeaderboardItem
              key={player.playerId}
              info={player}
              ranking={index + 1}
            />
          ))}
        </VStack>
      </VStack>
    </Card>
  );
}

function LeaderboardItem({
  info,
  ranking,
}: {
  info: LeaderboardPlayerInfo;
  ranking: number;
}) {
  return (
    <Card
      variant="outline"
      boxShadow={"md"}
      width="100%"
      padding={[2, 4]}
      bg={info.alive ? "white" : info.safe ? "green.200" : "red.200"}
    >
      <Flex
        direction={["column", "row"]}
        alignItems={["flex-start", "center"]}
        justifyContent="space-between"
        width="100%"
        position="relative"
      >
        <HStack spacing={[2, 4]} alignItems="center">
          <Avatar name={info.name} />
          <VStack alignItems="flex-start" spacing={[0, 1]} width={["100%", "auto"]}>
            <Text
              fontSize={["sm", "md"]}
              sx={info.alive || info.safe ? {} : { textDecoration: "line-through" }}
              isTruncated
              maxWidth={["100%", "auto"]}
            >
              {ranking}: {info.name}
            </Text>
            <Flex flexWrap="wrap" alignItems="center">
              <Text as="span" fontWeight="bold" fontSize={["sm", "md"]}>
                Splash Points:
              </Text>
              <Text as="span" ml={1} fontSize={["sm", "md"]}>
                {info.kills}
              </Text>
            </Flex>
            {!info.alive && !info.safe && (
              <Text fontSize={["sm", "md"]} color="gray.700">
                Splashed by {info.killedBy ?? "a mysterious whale"}
              </Text>
            )}
          </VStack>
        </HStack>
        {info.safe && (
          <Badge
            colorScheme="green"
            borderRadius="full"
            px={2}
            fontSize={["0.7em", "0.8em"]}
            mt={[2, 0]}
          >
            Safe
          </Badge>
        )}
      </Flex>
    </Card>
  );
}

export default Leaderboard;
