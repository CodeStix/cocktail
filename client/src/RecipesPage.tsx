import { Flex, Text, Button, Box, Card } from "@radix-ui/themes";
import { ClientMessage, Drink, ServerMessage } from "cocktail-shared";
import { SERVER_URL, SERVER_WS_URL, fetcher } from "./util";
import useSWR from "swr";
import { DrinkCard } from "./components/DrinkCard";

export function RecipesPage() {
    const { data: drinks } = useSWR<Drink[]>(SERVER_URL + "/api/drinks", fetcher);

    return (
        <Flex style={{ alignContent: "start" }} display="flex" flexGrow="1" p="4" wrap="wrap" gap="3">
            {drinks === null && <Text style={{ fontWeight: "bold" }}>Loading drinks...</Text>}
            {drinks?.map((drink) => (
                <DrinkCard
                    drink={drink}
                    key={drink.id}
                    onClick={() => {
                        console.log("mix", drink);
                    }}>
                    <Button
                        onClick={() => {
                            console.log("mix", drink);
                        }}
                        tabIndex={-1}
                        color="blue">
                        Mix this!
                    </Button>
                </DrinkCard>
            ))}
        </Flex>
    );
}
