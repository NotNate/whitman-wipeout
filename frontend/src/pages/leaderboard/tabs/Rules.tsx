import {
  List,
  ListItem,
  ListIcon,
  UnorderedList,
  Text,
  Stack,
  Card,
} from "@chakra-ui/react";

import { TimeIcon, ViewIcon } from "@chakra-ui/icons";

/**
 * Description of the rules and regulations of the game. Includes a few links
 * to a GroupMe, safe zones, safeties, etc.. This page is updated frequently
 * when there are new changes.
 */
function Rules() {
  return (
    <Stack alignItems="center">
      <Card
        variant="outline"
        boxShadow={"lg"}
        width="90%"
        minWidth="400px"
        padding={4}
        backgroundColor="yellow.100"
        display="flex"
        alignItems="center"
      >
        <Text fontWeight="extrabold">WARNING</Text>
        <Text fontWeight="normal" align="center">
          These rules are subject to slight changes, however changes will be
          announced{" "}
          <a href="https://groupme.com/join_group/104324243/NucXzY0F">
            <Text display="inline" color="blue.400">
              in the GroupMe
            </Text>
          </a>{" "}
          as they arise throughout the course of the game.
        </Text>
      </Card>
      <UnorderedList maxWidth="500px">
        <ListItem fontWeight="bold">
          Getting someone “out”
          <UnorderedList fontWeight="normal">
            <ListItem>
              You must squirt them with water directly from the whale squirter. The
              mechanism of water delivery must be from the whale squirter. Other
              delivery methods, such as a water bottle or a can of soda, do not
              count.
            </ListItem>
            <ListItem>
              The eliminations must be caught on video and uploaded to the GroupMe,
              linked{" "}
              <a href="https://groupme.com/join_group/104324243/NucXzY0F">
                <Text display="inline" color="blue.400">
                  HERE
                </Text>
              </a>
              . You must include the full name of the person you have eliminated.
            </ListItem>
            <ListItem>
              Once both members of a team have been eliminated, it will be registered here
              and will be displayed publicly on the leaderboard.
            </ListItem>
            <ListItem>
              After a eliminations is registered, the target of the eliminated will be
              reassigned to that of whom they were eliminated by.
            </ListItem>
            <ListItem>
              Eliminations are only valid during rounds (see info about rounds below). That is, in between the end of
              a round and the start of the next, liminations will not count. Eliminations
              must be sent in the GroupMe prior to the round ending, or they
              will not count.
            </ListItem>
            <ListItem>
              There are no shields. Holding a book up to protect yourself and
              “deflect” the water will still count as a eliminations.
            </ListItem>
          </UnorderedList>
        </ListItem>
        <ListItem fontWeight="bold">
          Auto-elimination
          <UnorderedList fontWeight="normal">
            <ListItem>
              There are 3 rounds of auto-elimination (rounds 1, 2, and 3), where
              teams must have a certain number of eliminations to move on.
            </ListItem>
            <ListItem>
              If a player does not have the minimum number of eliminations upon that
              round ending, they will be automatically eliminated.
            </ListItem>
            <ListItem>
              The eliminations do not have to be in the relevant round. A team must
              meet the threshold in total eliminations, which includes those from
              previous rounds.
            </ListItem>
          </UnorderedList>
        </ListItem>
        <ListItem fontWeight="bold">
          Safeties
          <UnorderedList fontWeight="normal">
            <ListItem>
              At times, there might be certain days or events that will give you safety. Be on the lookout in the GroupMe for these announcements.
            </ListItem>
            <ListItem>
              There will be various days where no daily safety is given.
              Safe zones (as listed below) are still valid during these days.
              This presents an opportunity for everyone to eliminate their
              target, regardless of who they are assigned.
            </ListItem>
          </UnorderedList>
        </ListItem>
        <ListItem fontWeight="bold">
          Safe zones
          <UnorderedList fontWeight="normal">
            <ListItem>
              This is the exhaustive list of places where a player cannot be
              eliminated.
              <UnorderedList fontWeight="normal">
                <ListItem>
                  Places of worship.
                </ListItem>
                <ListItem>
                  Only Whitman dining hall and the Pavillion are safe dining halls, no other dining halls are safe.
                </ListItem>
                <ListItem>
                  Practice and competition (during, and preparing for), but not
                  travelling to/from.
                </ListItem>
                <ListItem>
                  Own bedrooms and common rooms are safe, however other's
                  bedrooms and common rooms are fair game (Please use common sense).
                </ListItem>
                <ListItem>
                  Classrooms are safe ONLY active registrar scheduled instruction or exams are going on. More
                  specifically, the classroom is safe while you are inside during class, but not after class has ended.
                </ListItem>
              </UnorderedList>
            </ListItem>
            <ListItem>
              Being in a safe zone means that you are unable to eliminate or be
              eliminated. That is, eliminations from a player inside a safe zone to a
              player outside of a safe zone are not valid.
            </ListItem>
          </UnorderedList>
        </ListItem>
        <ListItem fontWeight="bold">
          Timeline
          <UnorderedList fontWeight="normal">
            <ListItem>
              There will be a total of a TBD amount of rounds, summing up to 8 days of
              in-game chaos.
            </ListItem>
            <ListItem>
              At the end of every round, all targets will be shuffled.
            </ListItem>
            <ListItem>
              The last round will be ANARCHY, which means there will be no
              safety, no safe words, and no safe zones.
            </ListItem>
            <ListItem>
              At the end of 11/24, if there is still more than a single person
              remaining, there will be a duel between the two remaining
              participants with the most eliminations.
            </ListItem>
            <ListItem>
              Under NO circumstances will there be multiple winners. There will
              be a SINGLE winner.
            </ListItem>
          </UnorderedList>
        </ListItem>
        <ListItem fontWeight="bold">
          Important dates
          <List fontWeight="normal">
            <ListItem>
              <ListIcon as={ViewIcon} color="green.500" />
              INITIAL TARGETS ANNOUNCED: 11/16 9AM
            </ListItem>
            <ListItem>
              <ListIcon as={TimeIcon} color="green.500" />
              START of ROUND 1: 11/16 9AM
            </ListItem>
            <ListItem>
              <ListIcon as={TimeIcon} color="red.500" />
              END of ROUND 1: 11/6 11:59PM (1 total eliminations required)
            </ListItem>
            <ListItem>
              <ListIcon as={TimeIcon} color="green.500" />
              START of ROUND 2: 11/19 9AM
            </ListItem>
            <ListItem>
              <ListIcon as={TimeIcon} color="red.500" />
              END of ROUND 2: 11/21 11:59PM (2 total eliminations required)
            </ListItem>
            <ListItem>
              <ListIcon as={TimeIcon} color="green.500" />
              START of ANARCHY: 11/22 9AM
            </ListItem>
            <ListItem>
              <ListIcon as={TimeIcon} color="red.500" />
              END of GAME: 11/24 11:59PM
            </ListItem>
          </List>
        </ListItem>
        <ListItem fontWeight="bold">
          Additional
          <UnorderedList fontWeight="normal">
            <ListItem>
              Let an RCA know if the website is breaking, Nathan will try to fix it ASAP.
            </ListItem>
            <ListItem>
              If there is a dispute, it will be ruled by majority vote of the RCAs or by GroupMe poll if applicable.
            </ListItem>
          </UnorderedList>
        </ListItem>
      </UnorderedList>
    </Stack>
  );
}

export default Rules;
