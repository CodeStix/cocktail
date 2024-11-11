import { Flex, Text, Button, Box, Card } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Drink } from "cocktail-shared";

const DRINKS: Drink[] = [
    {
        id: 0,
        name: "Mojito",
        themeColor: "green",
        description: "A well known and refreshing cocktail.",
        imageUrl: "public/cocktails/1.jpg",
    },
    {
        id: 1,
        name: "Sex on the beach",
        themeColor: "orange",
        description: "Very sweet and tasty.",
        imageUrl: "public/cocktails/2.jpg",
    },
    {
        id: 2,
        name: "Mai Tai",
        themeColor: "blue",
        description: "I don't know whats in it",
        imageUrl: "public/cocktails/3.jpg",
    },
];

function DrinkCard(props: { drink: Drink }) {
    const drink = props.drink;
    return (
        <Card
            style={{ maxWidth: "300px" }}
            asChild
            onClick={() => {
                console.log("drink", drink);
            }}>
            <button>
                <Flex gap="3">
                    <Box
                        flexShrink="0"
                        width="100px"
                        height="100px"
                        style={{ background: "var(--accent-5)", borderRadius: "var(--radius-1)", overflow: "hidden" }}>
                        {drink.imageUrl && <img style={{ objectFit: "cover" }} width="100%" height="100%" src={drink.imageUrl} />}
                    </Box>
                    <Flex flexGrow="1" direction="column">
                        <Text as="div" size="2" weight="bold">
                            {drink.name}
                        </Text>
                        {drink.description && (
                            <Text as="div" color="gray" size="2">
                                {drink.description}
                            </Text>
                        )}
                        <Button tabIndex={-1} mt="auto" style={{ alignSelf: "end" }} color="blue">
                            Mix this!
                        </Button>
                    </Flex>
                </Flex>
            </button>
        </Card>
    );
}

export function FrontPage() {
    return (
        <Flex style={{ alignContent: "start" }} display="flex" flexGrow="1" p="4" wrap="wrap" gap="3">
            {DRINKS.map((drink) => (
                <DrinkCard drink={drink} key={drink.id} />
            ))}
        </Flex>
    );
}
