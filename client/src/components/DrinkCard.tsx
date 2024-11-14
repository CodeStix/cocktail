import { Badge, Box, Card, Flex, Text } from "@radix-ui/themes";
import { Recipe } from "cocktail-shared";
import { SERVER_URL } from "../util";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEyeSlash } from "@fortawesome/free-regular-svg-icons";

export function RecipeCard(props: { recipe: Recipe; children?: React.ReactNode; onClick?: () => void }) {
    const recipe = props.recipe;
    return (
        <Card style={{ width: "400px" }} asChild>
            <button onClick={props.onClick}>
                <Flex gap="3">
                    <Box
                        flexShrink="0"
                        width="100px"
                        height="100px"
                        style={{ background: "var(--accent-5)", borderRadius: "var(--radius-1)", overflow: "hidden" }}>
                        {recipe.imageUrl && <img style={{ objectFit: "cover" }} width="100%" height="100%" src={SERVER_URL + recipe.imageUrl} />}
                    </Box>
                    <Flex flexGrow="1" direction="column">
                        <Flex align="center" gap="1">
                            <Text as="div" size="2" weight="bold">
                                {recipe.name}
                            </Text>
                            {!recipe.shown && (
                                <Badge color="red">
                                    <FontAwesomeIcon icon={faEyeSlash} /> Hidden
                                </Badge>
                            )}
                        </Flex>

                        {recipe.description && (
                            <Text as="div" color="gray" size="2" mb="1">
                                {recipe.description}
                            </Text>
                        )}
                        {props.children && (
                            <Flex style={{ alignSelf: "end" }} gap="1" mt="auto">
                                {props.children}
                            </Flex>
                        )}
                    </Flex>
                </Flex>
            </button>
        </Card>
    );
}
