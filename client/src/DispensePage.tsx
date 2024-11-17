import { useNavigate, useParams } from "react-router-dom";
import { SERVER_URL, SERVER_WS_URL, fetchJson, fetcher } from "./util";
import { ClientMessage, Output, Recipe } from "cocktail-shared";
import useSWR from "swr";
import { Box, Flex, Text } from "@radix-ui/themes";
import React, { useEffect, useRef, useState } from "react";
import useWebSocket from "react-use-websocket";

function Contents(props: { style?: React.CSSProperties; recipeNameColor: string; recipe: Recipe; status: { status: string; progress?: number } }) {
    return (
        <Flex
            style={props.style}
            direction="column"
            justify="center"
            align="center"
            position="absolute"
            bottom="0"
            left="0"
            width="100%"
            height="100%">
            <Text size="7" weight="bold" style={{ maxWidth: "500px", textAlign: "center" }}>
                {props.status.status === "waiting" ? (
                    <>
                        Press start to dispense your{" "}
                        <Text as="span" style={{ color: props.recipeNameColor }}>
                            {props.recipe.name}
                        </Text>
                        <Text size="2" as="p" style={{ opacity: 0.5 }} mt="2">
                            Place your cup under the nozzle and press start.
                        </Text>
                    </>
                ) : props.status.status === "dispensing" ? (
                    <>
                        Brewing your{" "}
                        <Text as="span" style={{ color: props.recipeNameColor }}>
                            {props.recipe.name}
                        </Text>
                    </>
                ) : props.status.status === "done" ? (
                    <>
                        Done! Enjoy your{" "}
                        <Text as="span" style={{ color: props.recipeNameColor }}>
                            {props.recipe.name}
                        </Text>
                        <Text size="2" as="p" style={{ opacity: 0.5 }} mt="2">
                            Remove your cup now!
                        </Text>
                    </>
                ) : (
                    <>Unknown state '{props.status.status}'</>
                )}
            </Text>
        </Flex>
    );
}

export function DispensePage() {
    const { id } = useParams();
    const { data: recipe } = useSWR<Recipe>(SERVER_URL + "/api/recipes/" + id, fetcher);
    const navigate = useNavigate();
    const { lastJsonMessage } = useWebSocket<ClientMessage>(SERVER_WS_URL);
    const [status, setStatus] = useState({ status: "waiting", progress: 0 });
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (!fetchedRef.current) {
            fetchJson("/api/recipes/" + id + "/dispense", "POST").then(() => {
                console.log("Dispense fetched");
            });
            fetchedRef.current = true;
        }
    }, []);

    useEffect(() => {
        if (!lastJsonMessage) return;

        if (lastJsonMessage.type == "status-update") {
            if (lastJsonMessage.status === "return-to-idle") {
                navigate("/");
            } else {
                const newStatus = { ...status, status: lastJsonMessage.status };
                if (typeof lastJsonMessage.progress !== "undefined") {
                    newStatus.progress = lastJsonMessage.progress;
                }

                setStatus(newStatus);
            }
        }
    }, [lastJsonMessage]);

    return (
        <Box position="relative" height="100%">
            {recipe && (
                <>
                    {/* <Contents recipe={recipe} status={status} style={{ color: "var(--white-contrast)" }} /> */}
                    <Contents
                        recipeNameColor={`var(--${recipe.themeColor}-indicator)`}
                        recipe={recipe}
                        status={status}
                        // style={{ color: `var(--${recipe.themeColor}-indicator)` }}
                    />
                    <Contents
                        recipeNameColor={`var(--${recipe.themeColor}-contrast)`}
                        recipe={recipe}
                        status={status}
                        style={{
                            background: `var(--${recipe.themeColor}-indicator)`,
                            color: `var(--${recipe.themeColor}-contrast)`,
                            clipPath: `inset(${Math.round((1 - status.progress) * 100)}% 0% 0% 0%)`,
                            transition: "200ms",
                        }}
                    />
                </>
            )}
        </Box>
    );
}