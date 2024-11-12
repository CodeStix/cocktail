import { Box, Card, Flex, Text } from "@radix-ui/themes";
import { Drink } from "cocktail-shared";
import { SERVER_URL } from "../util";

export function DrinkCard(props: { drink: Drink; children?: React.ReactNode; onClick: () => void }) {
    const drink = props.drink;
    return (
        <Card style={{ maxWidth: "300px" }} asChild>
            <button onClick={props.onClick}>
                <Flex gap="3">
                    <Box
                        flexShrink="0"
                        width="100px"
                        height="100px"
                        style={{ background: "var(--accent-5)", borderRadius: "var(--radius-1)", overflow: "hidden" }}>
                        {drink.imageUrl && <img style={{ objectFit: "cover" }} width="100%" height="100%" src={SERVER_URL + drink.imageUrl} />}
                    </Box>
                    <Flex flexGrow="1" direction="column">
                        <Text as="div" size="2" weight="bold">
                            {drink.name}
                        </Text>
                        {drink.description && (
                            <Text as="div" color="gray" size="2" mb="1">
                                {drink.description}
                            </Text>
                        )}
                        {props.children && (
                            <Flex style={{ alignSelf: "end" }} gap="1" mt="auto">
                                {props.children}
                            </Flex>
                        )}
                    </Flex>
                </Flex>
            </button>
        </Card>
    );
}
