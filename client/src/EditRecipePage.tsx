import {
    AlertDialog,
    Badge,
    Box,
    Button,
    Card,
    Flex,
    Grid,
    Heading,
    IconButton,
    Select,
    Separator,
    Skeleton,
    Switch,
    Text,
    TextArea,
    TextField,
} from "@radix-ui/themes";
import { Ingredient, Recipe, RecipeIngredient } from "cocktail-shared";
import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SERVER_URL, fetchJson, fetcher } from "./util";
import { UploadButton } from "./components/UploadButton";
import { RecipeCard } from "./components/RecipeCard";
import useSWR from "swr";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-regular-svg-icons";
import { faAdd, faRemove, faTrash } from "@fortawesome/free-solid-svg-icons";
import { KeyboardContext } from "./KeyboardContext";
import { ColorSelect } from "./components/ColorSelect";

export function EditIngredientForm(props: {
    ingredient: RecipeIngredient;
    onChange: (ingr: RecipeIngredient) => void;
    onDelete: (ingr: RecipeIngredient) => void;
}) {
    const { data: ingredients } = useSWR<Ingredient[]>(SERVER_URL + "/api/ingredients", fetcher);
    const ingr = props.ingredient;
    const [amount, setAmount] = useState("");
    const keyboard = useContext(KeyboardContext);

    useEffect(() => {
        console.log("setAmount, ingr", props.ingredient);
        setAmount(String(props.ingredient.amount));
    }, [props.ingredient]);

    function amountInputOnChange(value: string) {
        setAmount(value);
        keyboard.setValue(value);

        if (!value.endsWith(".")) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                console.log("match", value);
                props.onChange({ ...ingr, amount: num });
            }
        }
    }

    return (
        <Flex direction="column" gap="1" position="relative">
            <Box position="absolute" top="1" right="1">
                <IconButton size="3" color="red" onClick={() => props.onDelete(ingr)}>
                    <FontAwesomeIcon icon={faTrash} />
                </IconButton>
            </Box>
            <label>
                <Text as="div" size="2" mb="1" weight="bold">
                    Ingredient
                </Text>
                <Select.Root
                    required={false}
                    value={ingr.ingredientId === undefined ? "" : String(ingr.ingredientId)}
                    onValueChange={(value) => props.onChange({ ...ingr, ingredientId: value === "" ? undefined : parseInt(value) })}>
                    <Select.Trigger style={{ minWidth: "300px" }} placeholder="select output" />
                    <Select.Content>
                        {/* <Select.Item value="">Disable output</Select.Item> */}
                        {ingredients?.map((ing) => (
                            <Select.Item key={ing.id} value={String(ing.id)} style={{ textDecoration: ing.inFridge ? undefined : "line-through" }}>
                                {ing.name} {ing.inFridge ? <Badge color="green">In fridge</Badge> : <Badge color="red">Unavailable</Badge>}
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
                    onFocus={(ev) => keyboard.show(ev.target, (val) => amountInputOnChange(val))}
                    onBlur={() => keyboard.hide()}
                    value={amount}
                    onChange={(ev) => amountInputOnChange(ev.target.value)}>
                    <TextField.Slot side="right">ml</TextField.Slot>
                </TextField.Root>
                <Flex gap="1" mt="1" wrap="wrap">
                    {[10, 20, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400].map((e) => (
                        <Button
                            size="1"
                            color="blue"
                            variant="soft"
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

            <div>
                <Text as="div" size="2" mb="1" weight="bold">
                    Order
                </Text>
                <Flex gap="3" align="center">
                    <IconButton
                        style={{ fontWeight: "bold" }}
                        color="red"
                        variant="soft"
                        disabled={ingr.order <= 1}
                        onClick={() => props.onChange({ ...ingr, order: ingr.order - 1 })}>
                        -
                    </IconButton>
                    <Text weight="medium" size="5">
                        {ingr.order}
                    </Text>
                    <IconButton
                        style={{ fontWeight: "bold" }}
                        color="green"
                        variant="soft"
                        disabled={ingr.order >= 100}
                        onClick={() => props.onChange({ ...ingr, order: ingr.order + 1 })}>
                        +
                    </IconButton>
                </Flex>
            </div>
        </Flex>
    );
}

export function EditRecipePage() {
    const { id } = useParams();
    const [recipe, setRecipe] = useState<Recipe>();
    const [savedRecipe, setSavedRecipe] = useState<Recipe>();
    const [submitting, setSubmitting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const navigate = useNavigate();
    const keyboard = useContext(KeyboardContext);

    useEffect(() => {
        void fetchJson("/api/recipes/" + id, "GET").then((r) => {
            setRecipe(r as Recipe);
            setSavedRecipe(r as Recipe);
        });
    }, [id]);

    async function deleteRecipe() {
        setSubmitting(true);
        try {
            await new Promise((res) => setTimeout(res, 500));
            await fetchJson("/api/recipes/" + id, "DELETE");
            setShowDeleteDialog(false);
            navigate("/recipe");
        } finally {
            setSubmitting(false);
        }
    }

    async function updateRecipe() {
        setSubmitting(true);
        try {
            await new Promise((res) => setTimeout(res, 500));
            const updated: Recipe = await fetchJson("/api/recipes/" + id, "PATCH", recipe);
            setRecipe(updated);
            setSavedRecipe(updated);
            navigate("/recipe");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Flex direction="column" gap="3" p="4">
            <Flex gap="3">
                <Heading>Edit recipe</Heading>
                <Box flexGrow="1"></Box>
                <Button loading={submitting} disabled={!recipe || submitting || recipe === savedRecipe} onClick={() => updateRecipe()} color="green">
                    <FontAwesomeIcon icon={faSave} /> Save
                </Button>
            </Flex>
            {recipe ? (
                <>
                    <RecipeCard recipe={recipe} />

                    <label>
                        <Text as="div" size="2" mb="1" weight="bold">
                            Name
                        </Text>
                        <TextField.Root
                            onFocus={(ev) => keyboard.show(ev.target, (val) => setRecipe({ ...recipe, name: val }))}
                            onBlur={() => keyboard.hide()}
                            value={recipe.name}
                            onChange={(ev) => {
                                keyboard.setValue(ev.target.value);
                                setRecipe({ ...recipe, name: ev.target.value });
                            }}
                        />
                    </label>

                    <label>
                        <Text as="div" size="2" mb="1" weight="bold">
                            Description
                        </Text>
                        <TextArea
                            onFocus={(ev) => keyboard.show(ev.target, (val) => setRecipe({ ...recipe, description: val }))}
                            onBlur={() => keyboard.hide()}
                            value={recipe.description}
                            onChange={(ev) => {
                                keyboard.setValue(ev.target.value);
                                setRecipe({ ...recipe, description: ev.target.value });
                            }}
                        />
                    </label>

                    <Grid columns="2">
                        <label>
                            <Text as="div" size="2" mb="1" weight="bold">
                                Shown
                            </Text>
                            <Switch checked={recipe.shown} onCheckedChange={(checked) => setRecipe({ ...recipe, shown: checked })} />
                        </label>
                        <label>
                            <Text as="div" size="2" mb="1" weight="bold">
                                Hold to dispense
                            </Text>
                            <Switch
                                checked={recipe.holdToDispense}
                                onCheckedChange={(checked) => setRecipe({ ...recipe, holdToDispense: checked })}
                            />
                        </label>
                    </Grid>

                    <Box>
                        <Text as="div" size="2" mb="1" weight="bold">
                            Image
                        </Text>
                        <Flex gap="1">
                            <UploadButton onUploaded={(url) => setRecipe({ ...recipe, imageUrl: url })} />
                            {recipe.imageUrl && (
                                <Button color="red" onClick={() => setRecipe({ ...recipe, imageUrl: null })}>
                                    <FontAwesomeIcon icon={faRemove} /> Remove image
                                </Button>
                            )}
                        </Flex>
                    </Box>

                    <Box>
                        <Text as="div" size="2" mb="1" weight="bold">
                            Theme color
                        </Text>
                        <ColorSelect color={recipe.themeColor} onChange={(color) => setRecipe({ ...recipe, themeColor: color })} />
                    </Box>

                    <div>
                        <Flex align="end">
                            <Text as="div" size="2" mb="1" weight="bold">
                                Ingredients
                            </Text>
                        </Flex>

                        <Flex direction="column" gap="3" mt="1">
                            {recipe.ingredients.map((e, i) => (
                                <Card key={e.ingredientId}>
                                    <EditIngredientForm
                                        ingredient={e}
                                        onDelete={() => {
                                            const arr = [...recipe.ingredients];
                                            arr.splice(i, 1);
                                            setRecipe({ ...recipe, ingredients: arr });
                                        }}
                                        onChange={(ingr) => {
                                            const arr = [...recipe.ingredients];
                                            arr[i] = ingr;
                                            setRecipe({ ...recipe, ingredients: arr });
                                        }}
                                    />
                                </Card>
                            ))}

                            <Card>
                                <Flex height="200px" align="center" justify="center" direction="column" gap="1">
                                    {recipe.ingredients.length === 0 && (
                                        <Text size="4" style={{ opacity: 0.5 }}>
                                            No ingredients added yet!
                                        </Text>
                                    )}
                                    <Button
                                        color="green"
                                        size="3"
                                        onClick={() => {
                                            setRecipe({
                                                ...recipe,
                                                ingredients: [
                                                    ...recipe.ingredients,
                                                    {
                                                        amount: 100,
                                                        order: 1,
                                                        ingredient: undefined,
                                                        ingredientId: undefined,
                                                    },
                                                ],
                                            });
                                        }}>
                                        <FontAwesomeIcon icon={faAdd} /> Add ingredient
                                    </Button>
                                </Flex>
                            </Card>
                        </Flex>
                    </div>

                    <Separator mt="50vh" style={{ width: "100%" }} />

                    <Box>
                        <AlertDialog.Root open={showDeleteDialog} onOpenChange={(o) => setShowDeleteDialog(o)}>
                            <AlertDialog.Trigger>
                                <Button color="red" tabIndex={-1}>
                                    <FontAwesomeIcon icon={faTrash} /> Delete recipe
                                </Button>
                            </AlertDialog.Trigger>
                            <AlertDialog.Content maxWidth="450px">
                                <AlertDialog.Title>Delete recipe</AlertDialog.Title>
                                <AlertDialog.Description size="2">Are you sure you want to delete {recipe.name}?</AlertDialog.Description>

                                <Flex gap="3" mt="4" justify="end">
                                    <AlertDialog.Cancel>
                                        <Button variant="soft" color="gray">
                                            Cancel
                                        </Button>
                                    </AlertDialog.Cancel>
                                    <Button
                                        variant="solid"
                                        color="red"
                                        loading={submitting}
                                        disabled={submitting}
                                        onClick={() => {
                                            void deleteRecipe();
                                        }}>
                                        Yes, delete
                                    </Button>
                                </Flex>
                            </AlertDialog.Content>
                        </AlertDialog.Root>
                    </Box>
                </>
            ) : (
                <>
                    <Skeleton width="350px" height="126px"></Skeleton>
                    <Skeleton width="100%" height="61px"></Skeleton>
                    <Skeleton width="100%" height="97px"></Skeleton>
                </>
            )}
        </Flex>
    );
}
