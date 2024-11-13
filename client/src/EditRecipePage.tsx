import { Box, Button, Card, Flex, Heading, IconButton, Select, Switch, Text, TextArea, TextField } from "@radix-ui/themes";
import { Ingredient, Recipe, RecipeIngredient } from "cocktail-shared";
import { useEffect, useState } from "react";
import { unstable_usePrompt, useParams } from "react-router-dom";
import { SERVER_URL, fetchJson, fetcher } from "./util";
import { UploadButton } from "./components/UploadButton";
import { RecipeCard } from "./components/DrinkCard";
import useSWR from "swr";

export function EditIngredientForm(props: { ingredient: RecipeIngredient; onChange: (ingr: RecipeIngredient) => void }) {
    const { data: ingredients } = useSWR<Ingredient[]>(SERVER_URL + "/api/ingredients", fetcher);
    const ingr = props.ingredient;
    const [amount, setAmount] = useState("");

    useEffect(() => {
        setAmount(String(props.ingredient.amount));
    }, [props.ingredient]);

    return (
        <Flex direction="column" gap="1">
            <label>
                <Text as="div" size="2" mb="1" weight="bold">
                    Ingredient
                </Text>
                <Select.Root
                    required={false}
                    value={ingr.ingredientId === null ? "" : String(ingr.ingredientId)}
                    onValueChange={(value) => props.onChange({ ...ingr, ingredientId: value === "" ? null : parseInt(value) })}>
                    <Select.Trigger placeholder="select output" />
                    <Select.Content>
                        {/* <Select.Item value="">Disable output</Select.Item> */}
                        {ingredients?.map((ing) => (
                            <Select.Item key={ing.id} value={String(ing.id)}>
                                {ing.name} ({ing.remainingAmount} ml)
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
            </label>

            <label>
                <Text as="div" size="2" mb="1" weight="bold">
                    Amount
                </Text>
                <TextField.Root
                    value={amount}
                    onChange={(ev) => {
                        setAmount(ev.target.value);

                        const num = parseFloat(ev.target.value);
                        if (!isNaN(num)) {
                            props.onChange({ ...ingr, amount: num });
                        }
                    }}>
                    <TextField.Slot side="right">ml</TextField.Slot>
                </TextField.Root>
                <Flex gap="1" mt="1">
                    {[10, 20, 50, 75, 100, 125, 150, 200, 250, 300, 400].map((e) => (
                        <Button
                            size="1"
                            onClick={() =>
                                props.onChange({
                                    ...ingr,
                                    amount: e,
                                })
                            }
                            key={e}>
                            {e}ml
                        </Button>
                    ))}
                </Flex>
            </label>

            <label>
                <Text as="div" size="2" mb="1" weight="bold">
                    Order
                </Text>
                <Flex gap="3" align="center">
                    <IconButton variant="soft" disabled={ingr.order <= 1} onClick={() => props.onChange({ ...ingr, order: ingr.order - 1 })}>
                        -
                    </IconButton>
                    <Text weight="medium" size="5">
                        {ingr.order}
                    </Text>
                    <IconButton variant="soft" disabled={ingr.order >= 100} onClick={() => props.onChange({ ...ingr, order: ingr.order + 1 })}>
                        +
                    </IconButton>
                </Flex>
            </label>
        </Flex>
    );
}

export function EditRecipePage() {
    const { id } = useParams();
    const [recipe, setRecipe] = useState<Recipe>();
    const [savedRecipe, setSavedRecipe] = useState<Recipe>();

    useEffect(() => {
        void fetchJson("/api/recipes/" + id, "GET").then((r) => {
            setRecipe(r as Recipe);
            setSavedRecipe(r as Recipe);
        });
    }, [id]);

    async function updateRecipe() {
        const updated: Recipe = await fetchJson("/api/recipes/" + id, "PATCH", recipe);
        setRecipe(updated);
        setSavedRecipe(updated);
    }

    return (
        <Flex direction="column" gap="3" p="4">
            {recipe && (
                <>
                    <Flex>
                        <Heading>Edit recipe</Heading>
                        <Box flexGrow="1"></Box>
                        <Button disabled={recipe === savedRecipe} onClick={() => updateRecipe()} color="green">
                            Save
                        </Button>
                    </Flex>

                    <RecipeCard recipe={recipe} />

                    <label>
                        <Text as="div" size="2" mb="1" weight="bold">
                            Name
                        </Text>
                        <TextField.Root value={recipe.name} onChange={(ev) => setRecipe({ ...recipe, name: ev.target.value })} />
                    </label>

                    <label>
                        <Text as="div" size="2" mb="1" weight="bold">
                            Description
                        </Text>
                        <TextArea value={recipe.description} onChange={(ev) => setRecipe({ ...recipe, description: ev.target.value })} />
                    </label>

                    <label>
                        <Text as="div" size="2" mb="1" weight="bold">
                            Shown
                        </Text>
                        <Switch checked={recipe.shown} onCheckedChange={(checked) => setRecipe({ ...recipe, shown: checked })} />
                    </label>

                    <div>
                        <Text as="div" size="2" mb="1" weight="bold">
                            Image
                        </Text>
                        <Flex gap="1">
                            <UploadButton onUploaded={(url) => setRecipe({ ...recipe, imageUrl: url })} />
                            {recipe.imageUrl && (
                                <Button color="red" onClick={() => setRecipe({ ...recipe, imageUrl: null })}>
                                    Remove image
                                </Button>
                            )}
                        </Flex>
                    </div>

                    <div>
                        <Flex align="end">
                            <Text as="div" size="2" mb="1" weight="bold">
                                Ingredients
                            </Text>
                            <Box flexGrow="1"></Box>
                            <Button
                                color="blue"
                                onClick={() => {
                                    setRecipe({
                                        ...recipe,
                                        ingredients: [
                                            ...recipe.ingredients,
                                            {
                                                amount: 100,
                                                order: 1,
                                                ingredient: null,
                                                ingredientId: null,
                                            },
                                        ],
                                    });
                                }}>
                                Add ingredient
                            </Button>
                        </Flex>

                        <Flex direction="column" gap="3" mt="1">
                            {recipe.ingredients.map((e, i) => (
                                <Card>
                                    <EditIngredientForm
                                        key={e.ingredientId}
                                        ingredient={e}
                                        onChange={(ingr) => {
                                            const arr = [...recipe.ingredients];
                                            arr[i] = ingr;
                                            setRecipe({ ...recipe, ingredients: arr });
                                        }}
                                    />
                                </Card>
                            ))}
                            {recipe.ingredients.length === 0 && (
                                <Card style={{ opacity: 0.5 }}>
                                    <Flex height="200px" align="center" justify="center">
                                        <Text>No ingredients added yet!</Text>
                                    </Flex>
                                </Card>
                            )}
                        </Flex>
                    </div>
                </>
            )}
        </Flex>
    );
}
