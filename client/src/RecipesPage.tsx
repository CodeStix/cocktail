import { Flex, Text, Button, Box, Card, Heading, Skeleton } from "@radix-ui/themes";
import { ClientMessage, Recipe, ServerMessage } from "cocktail-shared";
import { SERVER_URL, SERVER_WS_URL, fetcher } from "./util";
import useSWR from "swr";
import { RecipeCard } from "./components/DrinkCard";

export function RecipesPage() {
    const { data: recipes } = useSWR<Recipe[]>(SERVER_URL + "/api/recipes", fetcher);

    return (
        <Flex direction="column" p="4" gap="3">
            <Flex>
                <Heading>Drinks</Heading>
                <Box flexGrow="1"></Box>
                {/* <Button onClick={() => newRecipe()}>New</Button> */}
            </Flex>
            <Flex style={{ alignContent: "start" }} display="flex" flexGrow="1" wrap="wrap" gap="3">
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
                )) ?? (
                    <>
                        <Skeleton width="400px" height="126px" />
                        <Skeleton width="400px" height="126px" />
                        <Skeleton width="400px" height="126px" />
                        <Skeleton width="400px" height="126px" />
                    </>
                )}
            </Flex>
        </Flex>
    );
}
