import { useNavigate, useParams } from "react-router-dom";
import { SERVER_WS_URL, fetchJson } from "./util";
import { ClientMessage, Recipe } from "cocktail-shared";
import { Box, Button, Card, Dialog, Flex, IconButton, Switch, Text } from "@radix-ui/themes";
import React, { useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faLongArrowAltDown } from "@fortawesome/free-solid-svg-icons";
import { faSave } from "@fortawesome/free-regular-svg-icons";
import { EditIngredientForm } from "./EditRecipePage";

function Contents(props: { style?: React.CSSProperties; recipeNameColor: string; recipe: Recipe; status: { status: string; progress?: number } }) {
    return (
        <Flex
            style={props.style}
            direction="column"
            justify="center"
            align="center"
            position="absolute"
            bottom="0"
            left="0"
            width="100%"
            height="100%">
            <Text size="7" weight="bold" style={{ maxWidth: "600px", textAlign: "center" }}>
                {props.status.status === "waiting" ? (
                    <>
                        {/* <Text size="2" as="p" style={{ opacity: 0.5 }} mt="2">
                            Place your cup under the nozzle and press start.
                        </Text> */}
                        <Text as="p">
                            Place your cup & press start to mix{" "}
                            <Text as="span" style={{ color: props.recipeNameColor }}>
                                {props.recipe.name}
                            </Text>
                        </Text>
                        <Text className="up-down-animation" as="p" size="9" mt="3">
                            <FontAwesomeIcon icon={faLongArrowAltDown} />
                        </Text>
                    </>
                ) : props.status.status === "dispensing" ? (
                    <>
                        Brewing your{" "}
                        <Text as="span" style={{ color: props.recipeNameColor }}>
                            {props.recipe.name}
                        </Text>
                    </>
                ) : props.status.status === "done" ? (
                    <>
                        Done! Enjoy your{" "}
                        <Text as="span" style={{ color: props.recipeNameColor }}>
                            {props.recipe.name}
                        </Text>
                        <Text size="2" as="p" style={{ opacity: 0.5 }} mt="2">
                            Remove your cup now!
                        </Text>
                    </>
                ) : (
                    <>Unknown state '{props.status.status}'</>
                )}
            </Text>
        </Flex>
    );
}

export function DispensePage() {
    const { id } = useParams();
    // const { data: recipe } = useSWR<Recipe>(SERVER_URL + "/api/recipes/" + id, fetcher);
    const navigate = useNavigate();
    const { lastJsonMessage } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    const [status, setStatus] = useState({ status: "waiting", progress: 0 });
    // const fetchedRef = useRef(false);
    const [showOverrideDialog, setShowOverrideDialog] = useState(false);
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchJson<Recipe>("/api/recipes/" + id, "GET").then((e) => {
            console.log("Got recipe", e);
            setRecipe(e);
            fetchPrepareDispense();
        });
    }, []);

    // useEffect(() => {
    //     if (!fetchedRef.current) {
    //         const recipeOverride: Partial<Recipe> = {
    //                 holdToDispense:
    //         };
    //         fetchedRef.current = true;
    //     }
    // }, []);

    async function fetchPrepareDispense(recipeOverride?: Recipe) {
        await fetchJson("/api/recipes/" + id + "/dispense", "POST", {
            recipeOverride: recipeOverride,
        });
        console.log("Prepare dispense fetched");
    }

    useEffect(() => {
        if (!lastJsonMessage) return;

        if (lastJsonMessage.type === "dispense-progress") {
            const newStatus = { ...status, status: lastJsonMessage.status };
            if (typeof lastJsonMessage.progress !== "undefined") {
                newStatus.progress = lastJsonMessage.progress;
            }

            setStatus(newStatus);
        } else if (lastJsonMessage.type === "state-change") {
            if (lastJsonMessage.to === "CLEAN" || lastJsonMessage.to === "IDLE") {
                navigate("/");
            }
        }
    }, [lastJsonMessage]);

    return (
        <Box position="relative" height="100%">
            {recipe && (
                <>
                    {/* <Contents recipe={recipe} status={status} style={{ color: "var(--white-contrast)" }} /> */}
                    <Contents
                        recipeNameColor={`var(--${recipe.themeColor}-indicator)`}
                        recipe={recipe}
                        status={status}
                        // style={{ color: `var(--${recipe.themeColor}-indicator)` }}
                    />
                    <Contents
                        recipeNameColor={`var(--${recipe.themeColor}-contrast)`}
                        recipe={recipe}
                        status={status}
                        style={{
                            background: `var(--${recipe.themeColor}-indicator)`,
                            color: `var(--${recipe.themeColor}-contrast)`,
                            clipPath: `inset(${Math.round((1 - status.progress) * 100)}% 0% 0% 0%)`,
                            transition: "200ms",
                        }}
                    />
                </>
            )}
            <Box position="absolute" right="4" top="4">
                <IconButton
                    onClick={() => {
                        setShowOverrideDialog(true);
                    }}>
                    <FontAwesomeIcon icon={faCog} />
                </IconButton>
            </Box>

            <Dialog.Root open={showOverrideDialog}>
                {/* <Dialog.Trigger>
		<Button>Adjust recipe</Button>
	</Dialog.Trigger> */}

                <Dialog.Content maxWidth="500px">
                    <Dialog.Title>Adjust {recipe?.name}</Dialog.Title>
                    <Dialog.Description size="2" mb="4">
                        You can temporarely override settings for this drink.
                    </Dialog.Description>

                    {recipe && (
                        <Flex direction="column" gap="3">
                            <label>
                                <Text as="div" size="2" mb="1" weight="bold">
                                    Hold to dispense
                                </Text>
                                <Switch
                                    checked={recipe.holdToDispense}
                                    onCheckedChange={(checked) => setRecipe({ ...recipe, holdToDispense: checked })}
                                />
                            </label>
                            {recipe.ingredients.map((e, i) => (
                                <Card key={e.ingredientId}>
                                    <EditIngredientForm
                                        ingredient={e}
                                        onChange={(ingr) => {
                                            const arr = [...recipe.ingredients];
                                            arr[i] = ingr;
                                            setRecipe({ ...recipe, ingredients: arr });
                                        }}
                                    />
                                </Card>
                            ))}
                        </Flex>
                    )}

                    <Flex gap="3" mt="4" justify="end">
                        <Dialog.Close>
                            <Button variant="soft" color="gray" onClick={() => setShowOverrideDialog(false)}>
                                Cancel
                            </Button>
                        </Dialog.Close>
                        <Dialog.Close>
                            <Button
                                disabled={submitting}
                                loading={submitting}
                                onClick={async () => {
                                    setSubmitting(true);
                                    try {
                                        await new Promise((res) => setTimeout(res, 200));
                                        await fetchPrepareDispense(recipe!);
                                        setShowOverrideDialog(false);
                                    } finally {
                                        setSubmitting(false);
                                    }
                                }}>
                                <FontAwesomeIcon icon={faSave} /> Save
                            </Button>
                        </Dialog.Close>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </Box>
    );
}
