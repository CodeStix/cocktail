export type Recipe = {
    id: number;
    name: string;
    description: string;
    imageUrl: string | null;
    themeColor: string;
    shown: boolean;
    ingredients: RecipeIngredient[];
};

export type RecipeIngredient = {
    ingredient?: Ingredient;
    ingredientId?: number;
    order: number;
    amount: number;
};

export type OutputSettings = {
    // type: "pump" | "valve" | "other";
    // Flow rate if applicable
    mlPerSecond?: number | "use-counter";
    // Amount of seconds needed to properly clean
    cleanSeconds?: number;
    // When true, output will be constantly on during the whole cleaning procedure
    requiredWhenCleaning?: boolean;
    // When true, output will be constantly on during dispensing
    requiredWhenDispensing?: boolean;
    // Will be included in a full-clean
    includeInFullClean?: boolean;
    // Activate this output when waste container is full
    enableWhenWasteFull?: boolean;
};

export type Output = {
    id: number;
    index: number;
    name: string;
    enabled?: boolean;
    settings: OutputSettings;
};

export type Ingredient = {
    id: number;
    name: string;
    imageUrl: string | null;
    output?: Output | null;
    outputId?: number | null;
    remainingAmount: number;
    originalAmount: number;
    infiniteAmount: boolean;
    inFridge: boolean;
    usedInRecipe?: {
        recipe: {
            name: string;
            id: number;
        };
    }[];
    themeColor: string;
};

export type ClientMessage =
    | {
          type: "all-outputs";
          outputs: Output[];
      }
    | {
          type: "dispense-progress";
          progress?: number;
          status: "dispensing" | "done" | "waiting";
      }
    | {
          type: "state-change";
          from: string;
          to: string;
      }
    | {
          type: "pressure-measurement";
          pressure: number;
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
