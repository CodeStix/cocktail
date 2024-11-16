import { Box, Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as packageJson from "../../package.json";
import Keyboard, { SimpleKeyboard } from "react-simple-keyboard";
import { KeyboardContext } from "../KeyboardContext";

export type KeyboardSettings = {
    onChange: (value: string) => void;
    hideOnEnter: boolean;
};

export function Layout(props: { children?: React.ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [keyboardShown, setKeyboardShown] = useState(false);
    const keyboardRef = useRef<SimpleKeyboard | null>(null);
    const keyboardSettingsRef = useRef<KeyboardSettings>({
        onChange: () => {},
        hideOnEnter: true,
    });
    const [layoutName, setLayoutName] = useState("default");

    // useEffect(() => {
    //     console.log("router.pathname", location.pathname);
    // }, [location.pathname]);

    function hideKeyboard() {
        setKeyboardShown(false);
    }

    function showKeyboard(input: HTMLInputElement | HTMLTextAreaElement, onChange: (value: string) => void, hideOnEnter = true) {
        input.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
        });
        keyboardRef.current!.setInput(input.value);
        keyboardSettingsRef.current = { onChange, hideOnEnter };
        setKeyboardShown(true);
    }

    return (
        <Flex maxHeight="100%" height="100%" direction="column" overflow="hidden">
            <Flex direction="column" flexGrow="1" overflow="auto">
                <KeyboardContext.Provider
                    value={{
                        setShown: setKeyboardShown,
                        shown: keyboardShown,
                        hide: hideKeyboard,
                        show: showKeyboard,
                        setValue: (value) => keyboardRef.current!.setInput(value),
                    }}>
                    {props.children}
                </KeyboardContext.Provider>
            </Flex>

            <Flex direction="column" style={{ background: "var(--accent-3)", borderTop: "1px solid var(--accent-7)" }}>
                {/* {showKeyboard && ( */}
                <Box className={keyboardShown ? "keyboard-show" : "keyboard-hide"} style={{ transition: "100ms" }} overflow="hidden">
                    <Keyboard
                        disableCaretPositioning
                        layoutName={layoutName}
                        keyboardRef={(e: SimpleKeyboard) => (keyboardRef.current = e)}
                        onChange={(input, ev) => {
                            ev?.preventDefault();
                            keyboardSettingsRef.current.onChange(input);
                        }}
                        onKeyPress={(button: string, ev) => {
                            ev?.preventDefault();
                            if (button === "{shift}" || button === "{lock}") {
                                setLayoutName(layoutName === "default" ? "shift" : "default");
                            }
                            if (keyboardSettingsRef.current.hideOnEnter && button === "{enter}") {
                                hideKeyboard();
                            }
                        }}
                    />
                </Box>
                {/* )} */}

                <Flex p="2">
                    <SegmentedControl.Root size="2" value={location.pathname}>
                        <SegmentedControl.Item value="/" onClick={() => navigate("/")}>
                            Dispense
                        </SegmentedControl.Item>
                        <SegmentedControl.Item value="/recipe" onClick={() => navigate("/recipe")}>
                            Recipes
                        </SegmentedControl.Item>
                        <SegmentedControl.Item value="/inventory" onClick={() => navigate("/inventory")}>
                            Inventory
                        </SegmentedControl.Item>
                        <SegmentedControl.Item value="/debug" onClick={() => navigate("/debug")}>
                            Outputs
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
        </Flex>
    );
}
