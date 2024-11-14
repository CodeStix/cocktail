import {
    AlertDialog,
    Badge,
    Box,
    Button,
    Callout,
    Card,
    Dialog,
    Flex,
    Heading,
    IconButton,
    Progress,
    Select,
    Separator,
    Skeleton,
    Switch,
    Text,
    TextField,
} from "@radix-ui/themes";
import { Ingredient, Output } from "cocktail-shared";
import { SERVER_URL, fetchJson, fetcher } from "./util";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { UploadButton } from "./components/UploadButton";
import { faEdit, faSave } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdd, faRemove, faTrash, faWarning } from "@fortawesome/free-solid-svg-icons";

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
                            <Button onClick={() => props.onEdit(ingredient)} tabIndex={-1} mt="auto" color="blue">
                                <FontAwesomeIcon icon={faEdit} /> Edit
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
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editing, setEditing] = useState<Ingredient | null>(null);
    const [remainingAmountStr, setRemainingAmountStr] = useState("");
    const [originalAmountStr, setOriginalAmountStr] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showDeleleDialog, setShowDeleteDialog] = useState(false);
    const cantDelete = (editing?.usedInRecipe ?? []).length > 0;

    async function updateIngredient() {
        setSubmitting(true);
        try {
            await new Promise((res) => setTimeout(res, 500));
            await fetchJson("/api/ingredients/" + editing!.id, "PATCH", editing);
            setShowEditDialog(false);
            mutate();
        } finally {
            setSubmitting(false);
        }
    }

    async function newIngredient() {
        const newIngredient = await fetchJson<Ingredient>("/api/ingredients", "POST");
        setEditing(newIngredient);
        setShowEditDialog(true);
    }

    async function deleteIngredient() {
        setSubmitting(true);
        try {
            await new Promise((res) => setTimeout(res, 500));
            await fetchJson("/api/ingredients/" + editing!.id, "DELETE");
            setShowDeleteDialog(false);
            setShowEditDialog(false);
            mutate();
        } finally {
            setSubmitting(false);
        }
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
                <Button disabled={!ingredients} color="green" onClick={() => newIngredient()}>
                    <FontAwesomeIcon icon={faAdd} /> New
                </Button>
            </Flex>
            <Flex wrap="wrap" gap="3" direction="column">
                {ingredients?.map((e) => (
                    <IngredientCard
                        ingredient={e}
                        onEdit={(ingr) => {
                            setEditing(ingr);
                            setShowEditDialog(true);
                        }}
                    />
                )) ?? (
                    <>
                        <Skeleton height="162px" />
                        <Skeleton height="162px" />
                        <Skeleton height="162px" />
                    </>
                )}

                <Dialog.Root open={showEditDialog}>
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

                                <label>
                                    <Text as="div" size="2" mb="1" weight="bold">
                                        Name
                                    </Text>
                                    <TextField.Root value={editing.name} onChange={(ev) => setEditing({ ...editing, name: ev.target.value })} />
                                </label>

                                <label>
                                    <Text as="div" size="2" mb="1" weight="bold">
                                        In fridge?
                                    </Text>
                                    <Switch checked={editing.inFridge} onCheckedChange={(checked) => setEditing({ ...editing, inFridge: checked })} />
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
                                            onClick={() =>
                                                setEditing({
                                                    ...editing,
                                                    remainingAmount: Math.max(0, editing.remainingAmount - 10),
                                                })
                                            }>
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
                                            disabled={editing.remainingAmount >= editing.originalAmount}
                                            onClick={() =>
                                                setEditing({
                                                    ...editing,
                                                    remainingAmount: Math.min(editing.originalAmount, editing.remainingAmount + 10),
                                                })
                                            }>
                                            + 10
                                        </Button>
                                        <Button
                                            variant="soft"
                                            color="green"
                                            disabled={editing.remainingAmount >= editing.originalAmount}
                                            onClick={() =>
                                                setEditing({
                                                    ...editing,
                                                    remainingAmount: Math.min(editing.originalAmount, editing.remainingAmount + 100),
                                                })
                                            }>
                                            + 100
                                        </Button>
                                    </Flex>
                                </div>

                                <div>
                                    <Text as="label" size="2" mb="1" weight="bold">
                                        Image
                                    </Text>
                                    <Flex gap="1">
                                        <UploadButton onUploaded={(url) => setEditing({ ...editing, imageUrl: url })} />
                                        {editing.imageUrl && (
                                            <Button color="red" onClick={() => setEditing({ ...editing, imageUrl: null })}>
                                                <FontAwesomeIcon icon={faRemove} /> Remove image
                                            </Button>
                                        )}
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
                                        Connected to
                                    </Text>
                                    <Select.Root
                                        required={false}
                                        value={editing.outputId === null ? "" : String(editing.outputId)}
                                        onValueChange={(value) => setEditing({ ...editing, outputId: value === "" ? null : parseInt(value) })}>
                                        <Select.Trigger placeholder="select output" style={{ minWidth: "300px" }} />
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
                                <Separator style={{ width: "100%" }} />
                            </Flex>
                            <Flex gap="3" mt="4">
                                {/* <Dialog.Close> */}
                                <Button variant="solid" color="red" onClick={() => setShowDeleteDialog(true)}>
                                    <FontAwesomeIcon icon={faTrash} /> Delete
                                </Button>
                                <Box flexGrow="1"></Box>
                                {/* </Dialog.Close> */}
                                <Dialog.Close>
                                    <Button variant="soft" color="gray" onClick={() => setShowEditDialog(false)}>
                                        Cancel
                                    </Button>
                                </Dialog.Close>
                                {/* <Dialog.Close> */}
                                <Button
                                    loading={submitting}
                                    disabled={submitting}
                                    color="green"
                                    onClick={() => {
                                        updateIngredient();
                                    }}>
                                    <FontAwesomeIcon icon={faSave} /> Save
                                </Button>
                                {/* </Dialog.Close> */}
                            </Flex>
                        </Dialog.Content>
                    )}
                </Dialog.Root>

                <AlertDialog.Root open={showDeleleDialog} onOpenChange={(o) => setShowDeleteDialog(o)}>
                    <AlertDialog.Content maxWidth="450px">
                        <AlertDialog.Title>Delete ingredient</AlertDialog.Title>
                        <AlertDialog.Description size="2">
                            {cantDelete ? (
                                <Callout.Root color="amber">
                                    <Callout.Icon>
                                        <FontAwesomeIcon icon={faWarning} />
                                    </Callout.Icon>
                                    <Callout.Text>
                                        This ingredient can't be removed because it is used by recipes (
                                        {(editing?.usedInRecipe ?? []).map((e) => e.recipe.name).join(", ")}), delete the recipes first.
                                    </Callout.Text>
                                </Callout.Root>
                            ) : (
                                <>Are you sure you want to delete {editing?.name}?</>
                            )}
                        </AlertDialog.Description>

                        <Flex gap="3" mt="4" justify="end">
                            <AlertDialog.Cancel>
                                <Button variant="soft" color="gray">
                                    Cancel
                                </Button>
                            </AlertDialog.Cancel>
                            <Button
                                loading={submitting}
                                disabled={submitting || cantDelete}
                                variant="solid"
                                color="red"
                                onClick={() => deleteIngredient()}>
                                Yes, delete
                            </Button>
                        </Flex>
                    </AlertDialog.Content>
                </AlertDialog.Root>
            </Flex>
        </Flex>
    );
}
