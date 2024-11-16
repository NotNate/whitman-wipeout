import { Box, Card, Text, VStack, HStack, Badge } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { fetchTarget } from "api/game/target";
import { TargetTeamInfo } from "shared/api/game/target";

/**
 * Page that displays a single card that shows the player's current target (or
 * states that it is not available)
 */
function TargetAssignment() {
  // Info about the target team
  const [target, setTarget] = useState<TargetTeamInfo | null>(null);
  // Whether or not there was an error retrieving the target
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Attempt to fetch
        const targetData = await fetchTarget();
        setTarget(targetData);
        setError(false);
      } catch (e) {
        // State that target is not available
        setError(true);
      }
    };
    fetchData();
  }, []);

  const isTeamSafe = target?.members.every(member => member.safe);
  const isTeamEliminated = target?.members.every(member => member.status === 'KILLED' || member.status === 'DISQUALIFIED');

  return (
    <Card
      variant="outline"
      boxShadow={"lg"}
      width="90%"
      minWidth="400px"
      padding={6}
      backgroundColor="orange.100"
    >
      <Box>
        {!error && target ? (
          <>
            <Text as="span" fontWeight="bold" fontSize="lg">
              Your goal is to collect the Splash Points from:
            </Text>
            <VStack align="start" spacing={3} mt={4}>
              {target.members.map((member, idx) => (
                <HStack key={idx}>
                  <Text fontWeight="medium">{member.name}</Text>
                  {member.status === 'KILLED' || member.status === 'DISQUALIFIED' ? (
                    <Badge colorScheme="red">Splashed</Badge>
                  ) : member.safe ? (
                    <Badge colorScheme="green">Safe</Badge>
                  ) : (
                    <Badge colorScheme="yellow">Active</Badge>
                  )}
                </HStack>
              ))}
            </VStack>
            {isTeamSafe && (
              <Text color="green.500" fontWeight="bold" mt={4}>
                The team is safe right now.
              </Text>
            )}
            {isTeamEliminated && (
              <Text color="red.500" fontWeight="bold" mt={4}>
                The targeted team has been eliminated.
              </Text>
            )}
          </>
        ) : (
          <>
            <Text as="span" fontWeight="bold" fontSize="lg">
              Your goal is not available.
            </Text>
          </>
        )}
      </Box>
    </Card>
  );
}

export default TargetAssignment;