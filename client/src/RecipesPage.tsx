import { Flex, Text, Button, Box, Card } from "@radix-ui/themes";
import { ClientMessage, Drink, ServerMessage } from "cocktail-shared";
import { SERVER_URL, SERVER_WS_URL, fetcher } from "./util";
import useSWR from "swr";
import { RecipeCard } from "./components/DrinkCard";

export function RecipesPage() {
    const { data: recipes } = useSWR<Drink[]>(SERVER_URL + "/api/recipes", fetcher);

    return (
        <Flex style={{ alignContent: "start" }} display="flex" flexGrow="1" p="4" wrap="wrap" gap="3">
            {recipes === null && <Text style={{ fontWeight: "bold" }}>Loading drinks...</Text>}
            {recipes?.map((drink) => (
                <RecipeCard
                    recipe={drink}
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
                </RecipeCard>
            ))}
        </Flex>
    );
}
