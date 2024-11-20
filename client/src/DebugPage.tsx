import {
    Badge,
    Button,
    Checkbox,
    Code,
    Dialog,
    Flex,
    Heading,
    IconButton,
    Select,
    Separator,
    Switch,
    Table,
    Text,
    TextField,
} from "@radix-ui/themes";
import { ClientMessage, Output } from "cocktail-shared";
import { useContext, useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";
import { SERVER_URL, SERVER_WS_URL, fetchJson, fetcher } from "./util";
import useSWR from "swr";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faSave, faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { KeyboardContext } from "./KeyboardContext";
import { faArrowUpFromGroundWater, faArrowsRotate, faHandHoldingDroplet, faShower, faSoap } from "@fortawesome/free-solid-svg-icons";
import * as packageJson from "../package.json";

// const DebugPageOutputSelect = React.memo(
//     (props: { output: Output; onChange: (newOutputIndex: number) => void }) => {
//         return (
//             <Select.Root size="1" value={String(props.output.index)} onValueChange={(value) => props.onChange(parseInt(value))}>
//                 <Select.Trigger />
//                 <Select.Content>
//                     {new Array(32).fill(0).map((_, i) => (
//                         <Select.Item key={i} value={String(i)}>
//                             {i < 16 ? <>12v relay {i}</> : <>24v relay {i - 16}</>}
//                         </Select.Item>
//                     ))}
//                 </Select.Content>
//             </Select.Root>
//         );
//     },
//     (a, b) => a.output.index === b.output.index
// );

// function DebugPageOutputSelect(props: { output: Output; onChange: (newOutputIndex: number) => void }) {
//     return (

//     );
// }

export function DebugPage() {
    const { lastJsonMessage } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    const { data: outputs, mutate } = useSWR<Output[]>(SERVER_URL + "/api/outputs", fetcher);
    const [editOutput, setEditOutput] = useState<Output>();
    const [showEditOutputDialog, setShowEditOutputDialog] = useState(false);
    const [mlPerSecondStr, setMlPerSecondStr] = useState("");
    const [cleanSecondsStr, setCleanSecondsStr] = useState("");
    const keyboard = useContext(KeyboardContext);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!lastJsonMessage) return;

        // console.log("lastJsonMessage", lastJsonMessage);

        if (lastJsonMessage.type == "all-outputs") {
            mutate(lastJsonMessage.outputs, { revalidate: false });
        }
    }, [lastJsonMessage]);

    useEffect(() => {
        if (editOutput) {
            setMlPerSecondStr(String(editOutput.settings.mlPerSecond ?? 10));
            setCleanSecondsStr(String(editOutput.settings.cleanSeconds ?? 0.5));
        }
    }, [editOutput]);

    async function setOutputEnabled(id: number, enabled: boolean) {
        await fetchJson("/api/outputs/" + id + "/enabled", "POST", { enabled });
    }

    async function updateOutput(id: number, values: Partial<Output>) {
        setSubmitting(true);
        try {
            // await new Promise((res) => setTimeout(res, 500));
            await fetchJson("/api/outputs/" + id, "PATCH", values);
            mutate();
        } finally {
            setSubmitting(false);
        }
    }

    async function performClean(thoroughly: boolean) {
        setSubmitting(true);
        try {
            await fetchJson("/api/clean", "POST", { thoroughly });
        } finally {
            setSubmitting(false);
        }
    }

    async function performRestart() {
        setSubmitting(true);
        try {
            await fetchJson("/api/restart", "POST");
        } finally {
            setSubmitting(false);
        }
    }

    function secondsToCleanChangeHandler(value: string) {
        setCleanSecondsStr(value);
        keyboard.setValue(value);

        if (!value.endsWith(".")) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                setEditOutput({
                    ...editOutput!,
                    settings: {
                        ...editOutput!.settings,
                        cleanSeconds: num,
                    },
                });
            }
        }
    }

    function mlPerSecondChangeHandler(value: string) {
        setMlPerSecondStr(value);
        keyboard.setValue(value);

        if (value === "use-counter") {
            setEditOutput({
                ...editOutput!,
                settings: {
                    ...editOutput!.settings,
                    mlPerSecond: value,
                },
            });
        } else if (!value.endsWith(".")) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                setEditOutput({
                    ...editOutput!,
                    settings: {
                        ...editOutput!.settings,
                        mlPerSecond: num,
                    },
                });
            }
        }
    }

    return (
        <Flex p="4" gap="3" direction="column" align="stretch">
            <Heading>Advanced settings</Heading>

            <Flex gap="1">
                <Button color="blue" disabled={submitting} onClick={() => performClean(true)}>
                    <FontAwesomeIcon icon={faShower} /> Perform full clean
                </Button>
                <Button color="blue" variant="outline" disabled={submitting} onClick={() => performClean(false)}>
                    <FontAwesomeIcon icon={faShower} /> Perform full clean (fast)
                </Button>
                <Separator mx="3" orientation="vertical" style={{ height: "100%" }} />
                <Button color="red" disabled={submitting} onClick={() => performRestart()}>
                    <FontAwesomeIcon icon={faArrowsRotate} /> Restart UI
                </Button>
            </Flex>

            {/* <Flex direction="column"> */}
            <Separator style={{ width: "100%" }} />
            <Table.Root layout="fixed" size="1" style={{ alignItems: "center", width: "100%" }}>
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeaderCell width="50px">ID</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell width="100px">Enable</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Properties</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Edit</Table.ColumnHeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {outputs?.map((output) => (
                        <Table.Row key={output.id} align="center">
                            <Table.Cell width="50px">
                                <Code>{output.id}</Code>
                            </Table.Cell>
                            <Table.Cell>
                                <TextField.Root
                                    size="1"
                                    placeholder="(unused)"
                                    defaultValue={output.name}
                                    onBlur={(ev) => updateOutput(output.id, { name: ev.target.value })}
                                />
                            </Table.Cell>
                            <Table.Cell>
                                <Switch
                                    style={{ marginTop: "2px" }}
                                    size="1"
                                    onCheckedChange={(checked) => setOutputEnabled(output.id, checked)}
                                    disabled={output.enabled === undefined}
                                    checked={output.enabled ?? false}
                                />
                            </Table.Cell>
                            <Table.Cell>
                                <Flex gap="1">
                                    {output.settings.includeInFullClean && (
                                        <Badge color="blue">
                                            <FontAwesomeIcon icon={faShower} /> {output.settings.cleanSeconds ?? 0.5} s
                                        </Badge>
                                    )}
                                    {output.settings.requiredWhenDispensing && (
                                        <Badge color="gray" size="2">
                                            <FontAwesomeIcon icon={faHandHoldingDroplet} />
                                        </Badge>
                                    )}
                                    {output.settings.requiredWhenCleaning && (
                                        <Badge color="green" size="2">
                                            <FontAwesomeIcon icon={faSoap} />
                                        </Badge>
                                    )}
                                    {output.settings.enableWhenWasteFull && (
                                        <Badge color="brown" size="2">
                                            <FontAwesomeIcon icon={faTrashAlt} />
                                        </Badge>
                                    )}
                                    <Badge color="blue">
                                        <FontAwesomeIcon icon={faArrowUpFromGroundWater} />{" "}
                                        {output.settings.mlPerSecond === "use-counter" ? (
                                            <>(sensor)</>
                                        ) : (
                                            <>{output.settings.mlPerSecond ?? 10} ml/s</>
                                        )}
                                    </Badge>
                                </Flex>
                            </Table.Cell>
                            <Table.Cell>
                                <IconButton
                                    size="1"
                                    color="blue"
                                    onClick={() => {
                                        setEditOutput(output);
                                        setShowEditOutputDialog(true);
                                    }}>
                                    <FontAwesomeIcon icon={faEdit} />
                                </IconButton>
                                {/* <DebugPageOutputSelect output={output} onChange={(value) => updateOutput(output.id, { index: value })} /> */}
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>

            <Text style={{ opacity: 0.5 }}>
                {packageJson.name} {packageJson.version}
            </Text>

            <Dialog.Root open={showEditOutputDialog} onOpenChange={(open) => setShowEditOutputDialog(open)}>
                <Dialog.Content maxWidth="450px">
                    <Dialog.Title>Edit output</Dialog.Title>
                    {/* <Dialog.Description size="2" mb="4">
                        Make changes to your profile.
                    </Dialog.Description> */}

                    {editOutput && (
                        <Flex direction="column" gap="3">
                            <label>
                                <Text as="div" size="2" mb="1" weight="bold">
                                    Name
                                </Text>
                                <TextField.Root
                                    // onFocus={(ev) => keyboard.show(ev.target, (val) => setEditOutput({ ...editOutput, name: val }))}
                                    // onBlur={() => keyboard.hide()}
                                    value={editOutput.name}
                                    onChange={(ev) => {
                                        keyboard.setValue(ev.target.value);
                                        setEditOutput({ ...editOutput, name: ev.target.value });
                                    }}
                                />
                            </label>

                            <label>
                                <Text as="div" size="2" mb="1" weight="bold">
                                    Output index
                                </Text>
                                <Select.Root
                                    value={String(editOutput.index)}
                                    onValueChange={(value) =>
                                        setEditOutput({
                                            ...editOutput,
                                            index: parseInt(value),
                                        })
                                    }>
                                    <Select.Trigger style={{ minWidth: "300px" }} />
                                    <Select.Content>
                                        {new Array(32).fill(0).map((_, i) => (
                                            <Select.Item key={i} value={String(i)}>
                                                {i < 16 ? <>12v relay {i}</> : <>24v relay {i - 16}</>}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </label>
                            <Separator style={{ width: "100%" }} />
                            <Flex direction="column" gap="1">
                                <Text as="label" size="2">
                                    <Flex gap="2" align="center">
                                        <Checkbox
                                            color="blue"
                                            checked={editOutput.settings.requiredWhenCleaning ?? false}
                                            size="1"
                                            onCheckedChange={(checked) =>
                                                setEditOutput({
                                                    ...editOutput,
                                                    settings: {
                                                        ...editOutput.settings,
                                                        requiredWhenCleaning: checked === true,
                                                    },
                                                })
                                            }
                                        />{" "}
                                        Required while cleaning
                                    </Flex>
                                </Text>

                                <Text as="label" size="2">
                                    <Flex gap="2" align="center">
                                        <Checkbox
                                            color="blue"
                                            checked={editOutput.settings.requiredWhenDispensing ?? false}
                                            size="1"
                                            onCheckedChange={(checked) =>
                                                setEditOutput({
                                                    ...editOutput,
                                                    settings: {
                                                        ...editOutput.settings,
                                                        requiredWhenDispensing: checked === true,
                                                    },
                                                })
                                            }
                                        />{" "}
                                        Required while dispensing
                                    </Flex>
                                </Text>

                                <Text as="label" size="2">
                                    <Flex gap="2" align="center">
                                        <Checkbox
                                            color="blue"
                                            checked={editOutput.settings.includeInFullClean ?? false}
                                            size="1"
                                            onCheckedChange={(checked) =>
                                                setEditOutput({
                                                    ...editOutput,
                                                    settings: {
                                                        ...editOutput.settings,
                                                        includeInFullClean: checked === true,
                                                    },
                                                })
                                            }
                                        />{" "}
                                        Include in full clean
                                    </Flex>
                                </Text>

                                <Text as="label" size="2">
                                    <Flex gap="2" align="center">
                                        Seconds to clean{" "}
                                        <TextField.Root
                                            // onFocus={(ev) => keyboard.show(ev.target, secondsToCleanChangeHandler)}
                                            // onBlur={() => keyboard.hide()}
                                            variant="soft"
                                            value={cleanSecondsStr}
                                            size="1"
                                            placeholder="0.5"
                                            onChange={(ev) => {
                                                const value = ev.target.value;
                                                secondsToCleanChangeHandler(value);
                                            }}
                                        />
                                    </Flex>
                                </Text>

                                <Text as="label" size="2">
                                    <Flex gap="2" align="center">
                                        Milliliter per second{" "}
                                        <TextField.Root
                                            // onFocus={(ev) => keyboard.show(ev.target, mlPerSecondChangeHandler)}
                                            // onBlur={() => keyboard.hide()}
                                            disabled={mlPerSecondStr === "use-counter"}
                                            variant="soft"
                                            value={mlPerSecondStr}
                                            size="1"
                                            placeholder="10"
                                            onChange={(ev) => {
                                                const value = ev.target.value;
                                                mlPerSecondChangeHandler(value);
                                            }}
                                        />
                                        <Checkbox
                                            checked={mlPerSecondStr === "use-counter"}
                                            onCheckedChange={(checked) => {
                                                mlPerSecondChangeHandler(checked ? "use-counter" : "10");
                                            }}
                                        />
                                        Sensor
                                    </Flex>
                                </Text>

                                <Text as="label" size="2">
                                    <Flex gap="2" align="center">
                                        <Checkbox
                                            color="blue"
                                            checked={editOutput.settings.enableWhenWasteFull ?? false}
                                            size="1"
                                            onCheckedChange={(checked) =>
                                                setEditOutput({
                                                    ...editOutput,
                                                    settings: {
                                                        ...editOutput.settings,
                                                        enableWhenWasteFull: checked === true,
                                                    },
                                                })
                                            }
                                        />{" "}
                                        Enable when waste full
                                    </Flex>
                                </Text>
                            </Flex>
                        </Flex>
                    )}

                    <Flex gap="3" mt="4" justify="end">
                        <Dialog.Close>
                            <Button variant="soft" color="gray">
                                Cancel
                            </Button>
                        </Dialog.Close>
                        <Button
                            onClick={async () => {
                                if (!editOutput) return;

                                await updateOutput(editOutput.id, {
                                    name: editOutput.name,
                                    index: editOutput.index,
                                    settings: editOutput.settings,
                                });

                                setShowEditOutputDialog(false);
                            }}
                            loading={submitting}
                            disabled={submitting}
                            color="green">
                            <FontAwesomeIcon icon={faSave} /> Save
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </Flex>
    );
}
