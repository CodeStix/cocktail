import { Flex, Button, Text, Heading, Box, IconButton } from "@radix-ui/themes";
import { Recipe } from "cocktail-shared";
import useSWR from "swr";
import { SERVER_URL, fetchJson, fetcher } from "./util";
import { RecipeCard } from "./components/DrinkCard";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import { faAdd, faTrash } from "@fortawesome/free-solid-svg-icons";

export function EditRecipesPage() {
    const { data: recipes } = useSWR<Recipe[]>(SERVER_URL + "/api/recipes?all=1", fetcher);
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
                <Button color="green" onClick={() => newRecipe()}>
                    <FontAwesomeIcon icon={faAdd} />
                    New
                </Button>
            </Flex>
            <Flex style={{ alignContent: "start" }} display="flex" flexGrow="1" wrap="wrap" gap="3">
                {recipes === null && <Text style={{ fontWeight: "bold" }}>Loading drinks...</Text>}
                {recipes?.map((recipe) => (
                    <RecipeCard recipe={recipe} key={recipe.id} onClick={() => navigate("/recipe/" + recipe.id)}>
                        <Button
                            color="blue"
                            onClick={() => {
                                navigate("/recipe/" + recipe.id);
                            }}
                            tabIndex={-1}>
                            <FontAwesomeIcon icon={faEdit} /> Edit
                        </Button>
                    </RecipeCard>
                ))}
            </Flex>
        </Flex>
    );
}
