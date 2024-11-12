import { Flex, Button, Text } from "@radix-ui/themes";
import { Drink } from "cocktail-shared";
import useSWR from "swr";
import { SERVER_URL, fetcher } from "./util";
import { DrinkCard } from "./components/DrinkCard";
import { useNavigate } from "react-router-dom";

export function EditRecipesPage() {
    const { data: drinks } = useSWR<Drink[]>(SERVER_URL + "/api/drinks", fetcher);
    const navigate = useNavigate();

    return (
        <Flex style={{ alignContent: "start" }} display="flex" flexGrow="1" p="4" wrap="wrap" gap="3">
            {drinks === null && <Text style={{ fontWeight: "bold" }}>Loading drinks...</Text>}
            {drinks?.map((recipe) => (
                <DrinkCard drink={recipe} key={recipe.id} onClick={() => navigate("/recipe/" + recipe.id)}>
                    <Button
                        onClick={() => {
                            navigate("/recipe/" + recipe.id);
                        }}
                        tabIndex={-1}>
                        Edit
                    </Button>
                </DrinkCard>
            ))}
        </Flex>
    );
}
