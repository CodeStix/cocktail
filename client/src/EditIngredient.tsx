import { Ingredient, Output, Recipe } from "cocktail-shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SERVER_URL, fetchJson, fetcher } from "./util";
import { AlertDialog, Text, Box, Button, Callout, Dialog, Flex, Select, Separator, Switch, TextField, Heading, Skeleton } from "@radix-ui/themes";
import { faSave } from "@fortawesome/free-regular-svg-icons";
import { faRemove, faTrash, faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import useSWR, { mutate } from "swr";
import { UploadButton } from "./components/UploadButton";

export function EditIngredientPage() {
    const { id } = useParams();
    const [editing, setEditing] = useState<Ingredient | null>(null);
    const { data: outputs } = useSWR<Output[]>(SERVER_URL + "/api/outputs", fetcher);
    const [remainingAmountStr, setRemainingAmountStr] = useState("");
    const [originalAmountStr, setOriginalAmountStr] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showDeleleDialog, setShowDeleteDialog] = useState(false);
    const cantDelete = (editing?.usedInRecipe ?? []).length > 0;
    const navigate = useNavigate();

    useEffect(() => {
        void fetchJson("/api/ingredient/" + id, "GET").then((e) => setEditing(e as Ingredient));
    }, []);

    useEffect(() => {
        if (editing) {
            setRemainingAmountStr(String(editing.remainingAmount));
            setOriginalAmountStr(String(editing.originalAmount));
        }
    }, [editing]);

    async function updateIngredient() {
        setSubmitting(true);
        try {
            await new Promise((res) => setTimeout(res, 500));
            await fetchJson("/api/ingredients/" + editing!.id, "PATCH", editing);
            navigate("/inventory");
        } finally {
            setSubmitting(false);
        }
    }
    async function deleteIngredient() {
        setSubmitting(true);
        try {
            await new Promise((res) => setTimeout(res, 500));
            await fetchJson("/api/ingredients/" + editing!.id, "DELETE");
            setShowDeleteDialog(false);
            navigate("/inventory");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Flex direction="column">
            <Flex gap="3" mt="4">
                <Heading>Edit {editing?.name}</Heading>
                <Dialog.Close>
                    <Button variant="soft" color="gray" onClick={() => navigate("/inventory")}>
                        Cancel
                    </Button>
                </Dialog.Close>
                <Button
                    loading={submitting}
                    disabled={submitting}
                    color="green"
                    onClick={() => {
                        updateIngredient();
                    }}>
                    <FontAwesomeIcon icon={faSave} /> Save
                </Button>
            </Flex>
            {editing ? (
                <>
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
                </>
            ) : (
                <>
                    <Skeleton height="120px"></Skeleton>
                </>
            )}

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
    );
}
