import { Box, Flex, Heading, Switch } from "@radix-ui/themes";
import { Layout } from "./components/Layout";
import { ClientMessage, ServerMessage } from "cocktail-shared";
import { useEffect, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { SERVER_WS_URL } from "./util";

export function DebugPage() {
    const { lastJsonMessage, sendJsonMessage, readyState } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    const [gpio, setGpio] = useState<boolean[] | null>(null);

    useEffect(() => {
        if (!lastJsonMessage) return;

        console.log("lastJsonMessage", lastJsonMessage);

        if (lastJsonMessage.type == "all-gpio") {
            setGpio(lastJsonMessage.values);
        }
    }, [lastJsonMessage]);

    useEffect(() => {
        if (readyState === ReadyState.OPEN) {
            sendJsonMessage({ type: "get-all-gpio" } as ServerMessage);
        }
    }, [readyState]);

    function updateGpio(idx: number, enable: boolean) {
        let message: ServerMessage = { type: "set-gpio", index: idx, value: enable };
        // console.log("setSwitchValue", message);
        sendJsonMessage(message);
    }

    return (
        <Flex p="4" gap="4">
            {gpio && (
                <Flex direction="column" width="50%">
                    <Heading>Relay 12v</Heading>
                    {gpio.map((enabled, i) => (
                        <Flex gap="1" align="center">
                            <Switch size="1" onCheckedChange={(checked) => updateGpio(i, checked)} checked={enabled} /> Output {i}
                        </Flex>
                    ))}
                    {/* <pre>{JSON.stringify(gpio.relay, null, 2)}</pre> */}
                </Flex>
            )}
        </Flex>
    );
}
