export type Recipe = {
    id: number;
    name: string;
    description: string;
    imageUrl: string | null;
    themeColor: string;
    shown: boolean;
    holdToDispense: boolean;
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

export type DispenseSequence = {
    ingredients: {
        ingredientId: number;
        startingMl: number;
        remainingMl: number;
    }[];
}[];

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

function getIngredientWithMaxAmount(ingrs: RecipeIngredient[]): RecipeIngredient | null {
    let maxIngredient: RecipeIngredient | null = null;
    for (const ingr of ingrs) {
        if (maxIngredient == null || ingr.amount > maxIngredient.amount) {
            maxIngredient = ingr;
        }
    }
    return maxIngredient;
}

export function recipeToDispenseSequence(recipe: Recipe, limitPartMl?: number): DispenseSequence {
    const sequence: DispenseSequence = [];

    let amountScale = 1;
    if (typeof limitPartMl === "number") {
        const ingrWithMaxAmount = getIngredientWithMaxAmount(recipe.ingredients);
        if (ingrWithMaxAmount !== null) {
            amountScale = Math.min(1, limitPartMl / ingrWithMaxAmount.amount);
        }
    }

    for (const ingr of recipe.ingredients) {
        if (!ingr.ingredient || typeof ingr.ingredient.outputId !== "number" || typeof ingr.ingredientId !== "number") {
            continue;
        }

        const data = {
            ingredientId: ingr.ingredientId,
            remainingMl: ingr.amount * amountScale,
            startingMl: ingr.amount * amountScale,
        };

        if (ingr.order in sequence) {
            sequence[ingr.order].ingredients.push(data);
        } else {
            sequence[ingr.order] = { ingredients: [data] };
        }
    }

    return sequence.filter((e) => !!e);
}
