import { Box, Flex, Heading, Switch } from "@radix-ui/themes";
import { Layout } from "./components/Layout";
import { ClientMessage, ServerMessage } from "cocktail-shared";
import { useEffect, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { SERVER_WS_URL } from "./util";

export function DebugPage() {
    const { lastJsonMessage, sendJsonMessage, readyState } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    const [gpio, setGpio] = useState<{ relay: number | null; relay24v: number | null }>({ relay: null, relay24v: null });

    useEffect(() => {
        if (!lastJsonMessage) return;

        console.log("lastJsonMessage", lastJsonMessage);

        if (lastJsonMessage.type == "all-gpio") {
            setGpio({
                relay: lastJsonMessage.relay !== undefined ? lastJsonMessage.relay : gpio.relay,
                relay24v: lastJsonMessage.relay24v !== undefined ? lastJsonMessage.relay24v : gpio.relay24v,
            });
        }
    }, [lastJsonMessage]);

    useEffect(() => {
        if (readyState === ReadyState.OPEN) {
            sendJsonMessage({ type: "get-all-gpio" } as ServerMessage);
        }
    }, [readyState]);

    function setSwitchValue(v24: boolean, idx: number, enable: boolean) {
        let num = v24 ? gpio.relay24v : gpio.relay;
        if (num === null) return;

        if (enable) {
            num |= 1 << idx;
        } else {
            num &= ~(1 << idx);
        }

        let message: ServerMessage;
        if (v24) {
            message = { type: "set-all-gpio", relay24v: num };
        } else {
            message = { type: "set-all-gpio", relay: num };
        }
        // console.log("setSwitchValue", message);
        sendJsonMessage(message);
    }

    function getSwitchValue(v24: boolean, idx: number): boolean {
        let num = v24 ? gpio.relay24v : gpio.relay;
        if (num === null) return false;
        // console.log("getSwitchValue", (num >>> 0).toString(2));
        return ((num >>> idx) & 0x1) == 0x1;
    }

    return (
        <Flex p="4" gap="4">
            <Flex direction="column" width="50%">
                <Heading>Relay 12v</Heading>
                {new Array(16).fill(0).map((_, i) => (
                    <Flex gap="1" align="center">
                        <Switch
                            disabled={gpio.relay === null}
                            size="1"
                            onCheckedChange={(checked) => setSwitchValue(false, i, checked)}
                            checked={getSwitchValue(false, i)}
                        />{" "}
                        Output {i}
                    </Flex>
                ))}
                <pre>{JSON.stringify(gpio.relay, null, 2)}</pre>
            </Flex>

            <Flex direction="column" width="50%">
                <Heading>Relay 24v</Heading>
                {new Array(16).fill(0).map((_, i) => (
                    <Flex gap="1" align="center">
                        <Switch
                            disabled={gpio.relay24v === null}
                            size="1"
                            onCheckedChange={(checked) => setSwitchValue(true, i, checked)}
                            checked={getSwitchValue(true, i)}
                        />{" "}
                        Output {i}
                    </Flex>
                ))}
                <pre>{JSON.stringify(gpio.relay24v, null, 2)}</pre>
            </Flex>
        </Flex>
    );
}
