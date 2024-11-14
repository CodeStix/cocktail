import { Flex, Heading, Select, Switch, Table, TextField } from "@radix-ui/themes";
import { ClientMessage, Output } from "cocktail-shared";
import { useEffect } from "react";
import useWebSocket from "react-use-websocket";
import { SERVER_URL, SERVER_WS_URL, fetchJson, fetcher } from "./util";
import useSWR from "swr";

export function DebugPage() {
    const { lastJsonMessage } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    const { data: outputs, mutate } = useSWR<Output[]>(SERVER_URL + "/api/outputs", fetcher);

    useEffect(() => {
        if (!lastJsonMessage) return;

        console.log("lastJsonMessage", lastJsonMessage);

        if (lastJsonMessage.type == "all-outputs") {
            mutate(lastJsonMessage.outputs, { revalidate: false });
        }
    }, [lastJsonMessage]);

    async function setOutputEnabled(id: number, enabled: boolean) {
        await fetchJson("/api/outputs/" + id + "/enabled", "POST", { enabled });
    }

    async function updateOutput(id: number, values: { name?: string; index?: number }) {
        await fetchJson("/api/outputs/" + id, "PATCH", { name: values.name, index: values.index });
    }

    return (
        <Flex p="4" gap="4" direction="column" align="stretch">
            {/* <Flex direction="column"> */}
            <Heading>Hardware outputs</Heading>
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
