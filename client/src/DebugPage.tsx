import { Box, Flex, Heading, Select, Switch, Table, Text, TextField } from "@radix-ui/themes";
import { Layout } from "./components/Layout";
import { ClientMessage, Output, ServerMessage } from "cocktail-shared";
import { useEffect, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { SERVER_WS_URL, fetchJson } from "./util";

export function DebugPage() {
    const { lastJsonMessage } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    const [outputs, setOutputs] = useState<Output[] | null>(null);

    useEffect(() => {
        if (!lastJsonMessage) return;

        console.log("lastJsonMessage", lastJsonMessage);

        if (lastJsonMessage.type == "all-outputs") {
            setOutputs(lastJsonMessage.outputs);
        }
    }, [lastJsonMessage]);

    async function setOutputEnabled(id: number, enabled: boolean) {
        await fetchJson("/api/outputs/" + id + "/enable", "POST", { enabled });
    }

    async function updateOutput(id: number, values: { name?: string; index?: number }) {
        await fetchJson("/api/outputs/" + id, "PATCH", { name: values.name, index: values.index });
    }

    return (
        <Flex p="4" gap="4" direction="column" align="stretch">
            {/* <Flex direction="column"> */}
            <Heading>Relay 12v</Heading>
            <Table.Root layout="fixed" size="1" style={{ alignItems: "center", width: "100%" }}>
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeaderCell>Enable</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Output</Table.ColumnHeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {outputs?.map((output) => (
                        <Table.Row key={output.id}>
                            <Table.Cell>
                                <Switch
                                    size="1"
                                    onCheckedChange={(checked) => setOutputEnabled(output.id, checked)}
                                    disabled={output.enabled === undefined}
                                    checked={output.enabled ?? false}
                                />
                            </Table.Cell>
                            <Table.Cell>
                                <TextField.Root
                                    size="1"
                                    placeholder="output name here"
                                    defaultValue={output.name}
                                    onBlur={(ev) => updateOutput(output.id, { name: ev.target.value })}
                                />
                            </Table.Cell>
                            <Table.Cell>
                                <Select.Root
                                    size="1"
                                    value={String(output.index)}
                                    onValueChange={(value) => updateOutput(output.index, { index: parseInt(value) })}>
                                    <Select.Trigger />
                                    <Select.Content>
                                        {new Array(32).fill(0).map((_, i) => (
                                            <Select.Item key={i} value={String(i)}>
                                                {i < 16 ? <>12v relay {i}</> : <>24v relay {i - 16}</>}
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Root>
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
            {/* <pre>{JSON.stringify(gpio.relay, null, 2)}</pre> */}
            {/* </Flex> */}
        </Flex>
    );
}
