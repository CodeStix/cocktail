import { Badge, Box, Button, Card, Flex, Heading, Progress, Skeleton, Text } from "@radix-ui/themes";
import { Ingredient } from "cocktail-shared";
import { SERVER_URL, fetchJson, fetcher } from "./util";
import useSWR from "swr";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";

export function IngredientCard(props: { ingredient: Ingredient; onEdit?: (ingredient: Ingredient) => void }) {
    const ingredient = props.ingredient;
    return (
        <Card
            // style={{ width: "500px" }}
            asChild
            onClick={() => {
                props.onEdit?.(ingredient);
            }}>
            <button>
                <Flex gap="3">
                    <Box
                        flexShrink="0"
                        width="100px"
                        height="100px"
                        style={{ background: "var(--accent-5)", borderRadius: "var(--radius-1)", overflow: "hidden" }}>
                        {ingredient.imageUrl && (
                            <img style={{ objectFit: "cover" }} width="100%" height="100%" src={SERVER_URL + ingredient.imageUrl} />
                        )}
                    </Box>
                    <Flex flexGrow="1" direction="column">
                        <Flex align="center" gap="2">
                            <Text as="p" size="4" weight="bold">
                                {ingredient.name}
                            </Text>
                            {ingredient.inFridge ? (
                                ingredient.remainingAmount < ingredient.originalAmount / 8 ? (
                                    <Badge color="amber">Almost empty</Badge>
                                ) : (
                                    <Badge color="green">In fridge</Badge>
                                )
                            ) : (
                                <Badge color="red">Unavailable</Badge>
                            )}
                        </Flex>

                        {ingredient.inFridge ? (
                            <>
                                <Box>
                                    <Progress color="blue" value={(ingredient.remainingAmount / ingredient.originalAmount) * 100} size="2" />
                                </Box>

                                <Text as="p" size="2">
                                    {ingredient.remainingAmount}/{ingredient.originalAmount}ml remaining
                                </Text>

                                <Text as="p" size="2" style={{ opacity: 0.5 }}>
                                    Connected to {ingredient.output?.name ?? "(nothing)"}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text as="p" size="2" style={{ opacity: 0.5 }}>
                                    Should connect to {ingredient.output?.name ?? "(nothing)"}
                                </Text>
                            </>
                        )}

                        {(ingredient.usedInRecipe ?? []).length > 0 && (
                            <Text as="p" size="2" style={{ opacity: 0.5 }}>
                                Used by {ingredient.usedInRecipe?.map((e) => e.recipe.name).join(", ")}
                            </Text>
                        )}

                        <Flex style={{ alignSelf: "end" }} mt="auto" gap="2">
                            {/* <Button
                                variant="ghost"
                                onClick={() => props.onEdit(ingredient)}
                                tabIndex={-1}
                                mt="auto"
                                style={{ alignSelf: "end", fontWeight: "bold" }}
                                color="blue">
                                Refill to {ingredient.originalAmount}ml
                            </Button> */}
                            {props.onEdit && (
                                <Button onClick={() => props.onEdit!(ingredient)} tabIndex={-1} mt="auto" color="blue">
                                    <FontAwesomeIcon icon={faEdit} /> Edit
                                </Button>
                            )}
                        </Flex>
                    </Flex>
                </Flex>
            </button>
        </Card>
    );
}

export function InventoryPage() {
    const { data: ingredients } = useSWR<Ingredient[]>(SERVER_URL + "/api/ingredients", fetcher);
    const navigate = useNavigate();

    async function newIngredient() {
        const newIngredient = await fetchJson<Ingredient>("/api/ingredients", "POST");
        navigate("/ingredients/" + newIngredient.id);
    }

    // const { lastJsonMessage, sendJsonMessage, readyState } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    // const [outputs, setOutputs] = useState<Output[] | null>(null);

    // useEffect(() => {
    //     if (!lastJsonMessage) return;

    //     console.log("lastJsonMessage", lastJsonMessage);

    //     if (lastJsonMessage.type == "all-outputs") {
    //         setOutputs(lastJsonMessage.outputs);
    //     }
    // }, [lastJsonMessage]);

    // useEffect(() => {
    //     if (readyState === ReadyState.OPEN) {
    //         sendJsonMessage({ type: "get-all-outputs" } as ServerMessage);
    //     }
    // }, [readyState]);

    return (
        <Flex direction="column" p="4" gap="3">
            <Flex>
                <Heading>Ingredients</Heading>
                <Box flexGrow="1"></Box>
                <Button disabled={!ingredients} color="green" onClick={() => newIngredient()}>
                    <FontAwesomeIcon icon={faAdd} /> New
                </Button>
            </Flex>
            <Flex wrap="wrap" gap="3" direction="column">
                {ingredients?.map((e) => (
                    <IngredientCard
                        ingredient={e}
                        onEdit={(ingr) => {
                            navigate("/ingredients/" + ingr.id);
                        }}
                    />
                )) ?? (
                    <>
                        <Skeleton height="162px" />
                        <Skeleton height="162px" />
                        <Skeleton height="162px" />
                    </>
                )}
            </Flex>
        </Flex>
    );
}
