export type Recipe = {
    id: number;
    name: string;
    description: string;
    imageUrl: string | null;
    themeColor: string;
    totalAmount: number;
    ingredients: RecipeIngredient[];
};

export type RecipeIngredient = {
    ingredient: Omit<Ingredient, "output"> | null;
    ingredientId: number | null;
    order: number;
    amount: number;
};

export type Output = {
    id: number;
    index: number;
    name: string;
    enabled?: boolean;
};

export type Ingredient = {
    id: number;
    name: string;
    imageUrl: string | null;
    output: {
        id: number;
        name: string;
        index: number;
    } | null;
    outputId: number | null;
    remainingAmount: number;
    inFridge: boolean;
};

export type ClientMessage = {
    type: "all-outputs";
    outputs: Output[];
};

// export type PatchIngredientRequest = {
//     id: number;
//     data: Partial<Ingredient>;
// };

// export type PatchIngredientResponse = {
//     ingredient: Ingredient;
// };

// export type GetIngredientsResponse = {
//     ingredients: Ingredient[];
// };

// export type DeleteIngredientsRequest = {
//     id: number;
// };

// export type PostIngredientRequest = {};

// export type PostIngredientResponse = {
//     ingredient: Ingredient;
// };

export type ServerMessage = { type: "test" };
