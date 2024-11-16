import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  Avatar,
  Badge,
  Box,
  Card,
  HStack,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
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
    <Tabs variant="soft-rounded" colorScheme="green">
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
    <Tabs variant="soft-rounded" colorScheme="blue">
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
  return <Box m={4}>{gameInfo?.role === "ADMIN" ? adminTabs : playerTabs}</Box>;
}

function LeaderboardList({ gameInfo }: { gameInfo: GameInfo }) {
  const [data, setData] = useState<LeaderboardPlayerInfo[]>([]);

  useEffect(() => {
    /* Grab user information on the leaderboard, make sure alive players are
    listed first, and then sort by kills. */
    const fetchData = async () => {
      const leaderboardData = await fetchLeaderboard();
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
  }, []);

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

  // Prepare team data
  const teams = groupByTeams(data).map((team) => {
    const teamKills = team.reduce((sum, player) => sum + player.kills, 0);
    return { teamPlayers: team, teamKills };
  });

  // Sort teams by teamKills descending
  const sortedTeams = teams.sort((a, b) => b.teamKills - a.teamKills);

  return (
    <Stack alignItems="center" width="100%">
      {gameInfo && <EventCountdown gameInfo={gameInfo} />}
      <Stack padding={4} alignItems="center" width="100%">
        {sortedTeams.map((team, index) => (
          <TeamLeaderboardItem
            key={team.teamPlayers.map((p) => p.playerId).join("-")}
            team={team}
            ranking={index + 1}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function TeamLeaderboardItem({
  team,
  ranking,
}: {
  team: { teamPlayers: LeaderboardPlayerInfo[]; teamKills: number };
  ranking: number;
}) {
  const isSolo = team.teamPlayers.length === 1;

  return (
    <Card
      variant="outline"
      boxShadow={"lg"}
      width="80%"
      minWidth="500px"
      padding={4}
      mb={4}
      sx={{ backgroundColor: "gray.50" }}
    >
      <Stack width="100%">
        {/* Team Header */}
        <HStack justifyContent="space-between" mb={4}>
          <Text fontSize="lg" fontWeight="bold">
            {ranking}: Team Splash Points: {team.teamKills}
          </Text>
          {/* Optional: Add a team badge or other team-level indicators here */}
        </HStack>

        {/* Solo Player Indicator */}
        {isSolo && (
          <Text fontStyle="italic" color="gray.600" mb={2}>
            Waiting for partner
          </Text>
        )}

        {/* Individual Team Members */}
        <Stack spacing={4}>
          {team.teamPlayers.map((player, index) => (
            <LeaderboardItem key={player.playerId} info={player} ranking={index + 1} />
          ))}
        </Stack>
      </Stack>
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
      minWidth="400px"
      key={info.playerId}
      sx={{ backgroundColor: info.alive ? "white" : info.safe ? "green.200" : "red.200" }}
    >
      <HStack padding={4} justifyContent="space-between" position="relative">
        <HStack>
          <Avatar name={info.name} />
          <Stack>
            <Text sx={info.alive || info.safe ? {} : { textDecoration: "line-through" }}>
              {ranking}: {info.name}
            </Text>
            <Box mt="-4">
              <Text as="span" fontWeight="bold">
                Splash Points:
              </Text>
              <Text as="span"> {info.kills}</Text>
            </Box>
            {!info.alive && !info.safe && (
              <Text>Splashed by {info.killedBy ?? "a mysterious whale"}</Text>
            )}
          </Stack>
        </HStack>
        {info.safe && (
          <Badge
            colorScheme="green"
            position="absolute"
            top="2"
            right="2"
            borderRadius="full"
            px="2"
            fontSize="0.8em"
          >
            Safe
          </Badge>
        )}
      </HStack>
    </Card>
  );
}

export default Leaderboard;
