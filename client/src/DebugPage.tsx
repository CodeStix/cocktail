import { Box, Flex, Heading, Select, Switch, Table, Text } from "@radix-ui/themes";
import { Layout } from "./components/Layout";
import { ClientMessage, ServerMessage } from "cocktail-shared";
import { useEffect, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { SERVER_WS_URL } from "./util";

export function DebugPage() {
    const { lastJsonMessage, sendJsonMessage, readyState } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    const [gpio, setGpio] = useState<{ value: boolean; function: string | null }[] | null>(null);
    const [gpioFunctions, setGpioFunctions] = useState<string[]>([]);

    useEffect(() => {
        if (!lastJsonMessage) return;

        console.log("lastJsonMessage", lastJsonMessage);

        if (lastJsonMessage.type == "all-gpio") {
            setGpio(lastJsonMessage.values);
        } else if (lastJsonMessage.type === "all-gpio-functions") {
            setGpioFunctions(lastJsonMessage.values);
        }
    }, [lastJsonMessage]);

    useEffect(() => {
        if (readyState === ReadyState.OPEN) {
            sendJsonMessage({ type: "get-all-gpio" } as ServerMessage);
            sendJsonMessage({ type: "get-all-gpio-functions" } as ServerMessage);
        }
    }, [readyState]);

    function updateGpio(idx: number, enable: boolean) {
        let message: ServerMessage = { type: "set-gpio", index: idx, value: enable };
        // console.log("setSwitchValue", message);
        sendJsonMessage(message);
    }

    function updateGpioFunction(idx: number, func: string) {
        let message: ServerMessage = { type: "set-gpio-function", index: idx, function: func };
        sendJsonMessage(message);
    }

    return (
        <Flex p="4" gap="4" direction="column" align="stretch">
            {/* <Flex direction="column"> */}
            <Heading>Relay 12v</Heading>
            <Table.Root layout="fixed" size="1" style={{ alignItems: "center", width: "100%" }}>
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeaderCell>Enable</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Output</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Function</Table.ColumnHeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {gpio?.map((output, i) => (
                        <Table.Row>
                            <Table.Cell>
                                <Switch size="1" onCheckedChange={(checked) => updateGpio(i, checked)} checked={output.value} />
                            </Table.Cell>
                            <Table.Cell>{i < 16 ? <Text>12v relay {i}</Text> : <Text>24v relay {i - 16}</Text>}</Table.Cell>
                            <Table.Cell>
                                <Select.Root size="1" value={output.function ?? "None"} onValueChange={(value) => updateGpioFunction(i, value)}>
                                    <Select.Trigger />
                                    <Select.Content>
                                        {gpioFunctions.map((e) => (
                                            <Select.Item key={e} value={e}>
                                                {e}
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
