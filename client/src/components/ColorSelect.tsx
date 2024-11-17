import { Flex, IconButton } from "@radix-ui/themes";

const COLORS = [
    "gray",
    "gold",
    "bronze",
    "brown",
    "yellow",
    "amber",
    "orange",
    "tomato",
    "red",
    "ruby",
    "crimson",
    "pink",
    "plum",
    "purple",
    "violet",
    "iris",
    "indigo",
    "blue",
    "cyan",
    "teal",
    "jade",
    "green",
    "grass",
    "lime",
    "mint",
    "sky",
] as const;

export function ColorSelect(props: { color: string; onChange: (color: string) => void }) {
    return (
        <Flex gap="2" overflow="auto">
            {COLORS.map((color) => (
                <IconButton
                    mb="1"
                    onClick={() => props.onChange(color)}
                    variant={props.color === color ? "outline" : "solid"}
                    color={color}></IconButton>
            ))}
        </Flex>
    );
}
