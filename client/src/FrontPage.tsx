import { Flex, Text, Button, Box, Card } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Drink } from "cocktail-shared";
import useSWR from "swr";
import { SERVER_URL, fetcher } from "./util";

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
    const { data } = useSWR<{ drinks: Drink[] }>(SERVER_URL + "/drinks", fetcher);

    return (
        <Flex style={{ alignContent: "start" }} display="flex" flexGrow="1" p="4" wrap="wrap" gap="3">
            {data?.drinks.map((drink) => (
                <DrinkCard drink={drink} key={drink.id} />
            ))}
        </Flex>
    );
}
