export type Drink = {
    id: number;
    name: string;
    description?: string;
    themeColor: string;
    imageUrl?: string;
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

export type ClientMessage =
    | {
          type: "drinks";
          drinks: Drink[];
      }
    | {
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

export type ServerMessage =
    | { type: "get-drinks" }
    | { type: "get-all-outputs" }
    | { type: "update-output"; id: number; name?: string; index?: number }
    | { type: "set-output-enabled"; id: number; enabled: boolean };
