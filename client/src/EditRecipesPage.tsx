import { Flex, Button, Text, Heading, Box } from "@radix-ui/themes";
import { Recipe } from "cocktail-shared";
import useSWR from "swr";
import { SERVER_URL, fetchJson, fetcher } from "./util";
import { RecipeCard } from "./components/DrinkCard";
import { useNavigate } from "react-router-dom";

export function EditRecipesPage() {
    const { data: recipes } = useSWR<Recipe[]>(SERVER_URL + "/api/recipes", fetcher);
    const navigate = useNavigate();

    async function newRecipe() {
        const res = await fetchJson<Recipe>("/api/recipes", "POST");
        navigate("/recipe/" + res.id);
    }

    return (
        <Flex p="4" direction="column" gap="3">
            <Flex>
                <Heading>Recipes</Heading>
                <Box flexGrow="1"></Box>
                <Button onClick={() => newRecipe()}>New</Button>
            </Flex>
            <Flex style={{ alignContent: "start" }} display="flex" flexGrow="1" wrap="wrap" gap="3">
                {recipes === null && <Text style={{ fontWeight: "bold" }}>Loading drinks...</Text>}
                {recipes?.map((recipe) => (
                    <RecipeCard recipe={recipe} key={recipe.id} onClick={() => navigate("/recipe/" + recipe.id)}>
                        <Button
                            onClick={() => {
                                navigate("/recipe/" + recipe.id);
                            }}
                            tabIndex={-1}>
                            Edit
                        </Button>
                    </RecipeCard>
                ))}
            </Flex>
        </Flex>
    );
}
