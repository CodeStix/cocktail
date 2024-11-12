import { Box, Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as packageJson from "../../package.json";

export function Layout(props: { children?: React.ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        console.log("router.pathname", location.pathname);
    }, [location.pathname]);

    return (
        <Flex maxHeight="100%" height="100%" direction="column" overflow="hidden">
            <Flex direction="column" flexGrow="1" overflow="auto">
                {props.children}
            </Flex>
            <Flex p="2" style={{ background: "var(--accent-3)", borderTop: "1px solid var(--accent-7)" }}>
                <SegmentedControl.Root size="2" value={location.pathname}>
                    <SegmentedControl.Item value="/" onClick={() => navigate("/")}>
                        Drinks
                    </SegmentedControl.Item>
                    <SegmentedControl.Item value="/inventory" onClick={() => navigate("/inventory")}>
                        Inventory
                    </SegmentedControl.Item>
                    <SegmentedControl.Item value="/debug" onClick={() => navigate("/debug")}>
                        Debug
                    </SegmentedControl.Item>
                </SegmentedControl.Root>

                <Box flexGrow="1"></Box>
                <Flex align="center" justify="center">
                    <Text style={{ opacity: 0.5 }}>
                        {" "}
                        {packageJson.name} {packageJson.version}
                    </Text>
                </Flex>
            </Flex>
        </Flex>
    );
}
