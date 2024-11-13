import { Badge, Box, Button, Card, Dialog, Flex, Heading, IconButton, Progress, Select, Separator, Switch, Text, TextField } from "@radix-ui/themes";
import { Ingredient, Output } from "cocktail-shared";
import { SERVER_URL, fetchJson, fetcher } from "./util";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { UploadButton } from "./components/UploadButton";

function IngredientCard(props: { ingredient: Ingredient; onEdit: (ingredient: Ingredient) => void }) {
    const ingredient = props.ingredient;
    return (
        <Card
            // style={{ width: "500px" }}
            asChild
            onClick={() => {
                props.onEdit(ingredient);
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
                            <Button onClick={() => props.onEdit(ingredient)} tabIndex={-1} mt="auto" color="blue">
                                Edit
                            </Button>
                        </Flex>
                    </Flex>
                </Flex>
            </button>
        </Card>
    );
}

export function InventoryPage() {
    const { data: ingredients, mutate } = useSWR<Ingredient[]>(SERVER_URL + "/api/ingredients", fetcher);
    const { data: outputs } = useSWR<Output[]>(SERVER_URL + "/api/outputs", fetcher);
    const [edit, setEdit] = useState(false);
    const [editing, setEditing] = useState<Ingredient | null>(null);
    const [remainingAmountStr, setRemainingAmountStr] = useState("");
    const [originalAmountStr, setOriginalAmountStr] = useState("");

    async function updateIngredient() {
        await fetchJson("/api/ingredients/" + editing!.id, "PATCH", editing);
        setEdit(false);
        mutate();
    }

    async function newIngredient() {
        const newIngredient = await fetchJson<Ingredient>("/api/ingredients", "POST");
        setEditing(newIngredient);
        setEdit(true);
    }

    useEffect(() => {
        if (editing) {
            setRemainingAmountStr(String(editing.remainingAmount));
            setOriginalAmountStr(String(editing.originalAmount));
        }
    }, [editing]);

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
                <Button onClick={() => newIngredient()}>New</Button>
            </Flex>
            <Flex wrap="wrap" gap="3" direction="column">
                {ingredients?.map((e) => (
                    <IngredientCard
                        ingredient={e}
                        onEdit={(ingr) => {
                            setEditing(ingr);
                            setEdit(true);
                        }}
                    />
                ))}

                <Dialog.Root open={edit}>
                    {/* <Dialog.Trigger>
                    <Button>Edit {editing?.name}</Button>
                </Dialog.Trigger> */}

                    {editing && (
                        <Dialog.Content maxWidth="450px">
                            <Dialog.Title>Edit {editing?.name}</Dialog.Title>

                            <Flex direction="column" gap="4">
                                <Button
                                    onClick={() => setEditing({ ...editing, remainingAmount: editing.originalAmount })}
                                    tabIndex={-1}
                                    mt="auto"
                                    // style={{ alignSelf: "end", fontWeight: "bold" }}
                                    color="blue">
                                    Refill to {editing.originalAmount}ml
                                </Button>
                                <Separator style={{ width: "100%" }} />

                                <div>
                                    <Text as="label" size="2" mb="1" weight="bold">
                                        Image
                                    </Text>
                                    <Flex gap="1">
                                        <UploadButton onUploaded={(url) => setEditing({ ...editing, imageUrl: url })} />
                                        {editing.imageUrl && (
                                            <Button color="red" onClick={() => setEditing({ ...editing, imageUrl: null })}>
                                                Remove image
                                            </Button>
                                        )}
                                    </Flex>
                                </div>
                                <label>
                                    <Text as="div" size="2" mb="1" weight="bold">
                                        Name
                                    </Text>
                                    <TextField.Root value={editing.name} onChange={(ev) => setEditing({ ...editing, name: ev.target.value })} />
                                </label>

                                <div>
                                    <Text as="div" size="2" mb="1" weight="bold">
                                        Original amount (ml)
                                    </Text>
                                    <Flex align="center" gap="1">
                                        <Button
                                            variant="soft"
                                            color="red"
                                            onClick={() => setEditing({ ...editing, originalAmount: Math.max(0, editing.originalAmount - 100) })}>
                                            - 100
                                        </Button>
                                        <Button
                                            variant="soft"
                                            color="red"
                                            onClick={() => setEditing({ ...editing, originalAmount: Math.max(0, editing.originalAmount - 10) })}>
                                            - 10
                                        </Button>
                                        <TextField.Root
                                            value={originalAmountStr}
                                            onChange={(ev) => {
                                                const str = ev.target.value;
                                                setOriginalAmountStr(str);

                                                const num = parseFloat(str);
                                                if (!isNaN(num)) {
                                                    setEditing({ ...editing, originalAmount: num });
                                                }
                                            }}>
                                            <TextField.Slot side="right">ml</TextField.Slot>
                                        </TextField.Root>
                                        <Button
                                            variant="soft"
                                            color="green"
                                            onClick={() => setEditing({ ...editing, originalAmount: editing.originalAmount + 10 })}>
                                            + 10
                                        </Button>
                                        <Button
                                            variant="soft"
                                            color="green"
                                            onClick={() => setEditing({ ...editing, originalAmount: editing.originalAmount + 100 })}>
                                            + 100
                                        </Button>
                                    </Flex>
                                </div>

                                <div>
                                    <Text as="div" size="2" mb="1" weight="bold">
                                        Remaining amount (ml)
                                    </Text>
                                    <Flex align="center" gap="1">
                                        <Button
                                            variant="soft"
                                            color="red"
                                            onClick={() => setEditing({ ...editing, remainingAmount: Math.max(0, editing.remainingAmount - 100) })}>
                                            - 100
                                        </Button>
                                        <Button
                                            variant="soft"
                                            color="red"
                                            onClick={() => setEditing({ ...editing, remainingAmount: Math.max(0, editing.remainingAmount - 10) })}>
                                            - 10
                                        </Button>
                                        <TextField.Root
                                            value={remainingAmountStr}
                                            onChange={(ev) => {
                                                const str = ev.target.value;
                                                setRemainingAmountStr(str);

                                                const num = parseFloat(str);
                                                if (!isNaN(num)) {
                                                    setEditing({ ...editing, remainingAmount: num });
                                                }
                                            }}>
                                            <TextField.Slot side="right">ml</TextField.Slot>
                                        </TextField.Root>
                                        <Button
                                            variant="soft"
                                            color="green"
                                            onClick={() => setEditing({ ...editing, remainingAmount: editing.remainingAmount + 10 })}>
                                            + 10
                                        </Button>
                                        <Button
                                            variant="soft"
                                            color="green"
                                            onClick={() => setEditing({ ...editing, remainingAmount: editing.remainingAmount + 100 })}>
                                            + 100
                                        </Button>
                                    </Flex>
                                </div>
                                {/* <Flex gap="1" mt="1">
                                        {[0, 100, 250, 500, 750, 1000, 1500].map((e) => (
                                            <Button
                                                size="1"
                                                onClick={() =>
                                                    setEditing({
                                                        ...editing,
                                                        remainingAmount: e,
                                                    })
                                                }
                                                key={e}>
                                                {e}ml
                                            </Button>
                                        ))}
                                    </Flex> */}
                                <label>
                                    <Text as="div" size="2" mb="1" weight="bold">
                                        In fridge?
                                    </Text>
                                    <Switch checked={editing.inFridge} onCheckedChange={(checked) => setEditing({ ...editing, inFridge: checked })} />
                                </label>

                                <label>
                                    <Text as="div" size="2" mb="1" weight="bold">
                                        Connected to
                                    </Text>
                                    <Select.Root
                                        required={false}
                                        value={editing.outputId === null ? "" : String(editing.outputId)}
                                        onValueChange={(value) => setEditing({ ...editing, outputId: value === "" ? null : parseInt(value) })}>
                                        <Select.Trigger placeholder="select output" />
                                        <Select.Content>
                                            {/* <Select.Item value="">Disable output</Select.Item> */}
                                            {outputs?.map((output) => (
                                                <Select.Item key={output.id} value={String(output.id)}>
                                                    {output.name}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                </label>
                            </Flex>

                            <Flex gap="3" mt="4" justify="end">
                                <Dialog.Close>
                                    <Button variant="soft" color="gray" onClick={() => setEdit(false)}>
                                        Cancel
                                    </Button>
                                </Dialog.Close>
                                <Dialog.Close>
                                    <Button
                                        onClick={() => {
                                            updateIngredient();
                                        }}>
                                        Save
                                    </Button>
                                </Dialog.Close>
                            </Flex>
                        </Dialog.Content>
                    )}
                </Dialog.Root>
            </Flex>
        </Flex>
    );
}
