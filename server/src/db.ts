import { PrismaClient } from "@prisma/client";
import chalk from "chalk";
import { Ingredient, Output, OutputSettings, Recipe } from "cocktail-shared";

export const database = new PrismaClient();

let cachedOutputs: Output[] | null = null;

export async function getAllOutputs(): Promise<Output[]> {
    if (cachedOutputs == null) {
        cachedOutputs = [];
        for (const out of await database.output.findMany()) {
            cachedOutputs.push({
                id: out.id,
                index: out.index,
                name: out.name,
                settings: JSON.parse(out.settings),
            });
        }
    }
    return cachedOutputs;
}

export async function getOutputById(id: number): Promise<Output> {
    let outputs = await getAllOutputs();
    let output = outputs.find((e) => e.id === id);
    if (!output) {
        throw new Error("Output with id not found " + id);
    }
    return output;
}

export async function insertDefaultOutputsIfNone() {
    if ((await database.output.count()) <= 0) {
        await insertDefaultOutputs();
    }
}

export async function insertDefaultOutputs() {
    await database.output.createMany({
        data: new Array(32).fill(0).map((_, idx) => ({
            index: idx,
            name: "Output " + idx,
        })),
    });
    cachedOutputs = null;
}

export async function updateOutput(id: number, values: { name?: string; index?: number; settings?: OutputSettings }): Promise<Output> {
    const newOutput = await database.output.update({
        where: {
            id: id,
        },
        data: {
            name: values.name,
            index: values.index,
            settings: values.settings ? JSON.stringify(values.settings) : undefined,
        },
    });
    cachedOutputs = null;
    return {
        id: newOutput.id,
        name: newOutput.name,
        index: newOutput.index,
        settings: JSON.parse(newOutput.settings),
    };
}

export async function getIngredients(): Promise<Ingredient[]> {
    const ingredients = await database.ingredient.findMany({
        select: {
            id: true,
            imageUrl: true,
            inFridge: true,
            name: true,
            output: {
                select: {
                    id: true,
                    index: true,
                    name: true,
                },
            },
            usedInRecipe: {
                select: {
                    recipe: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            outputId: true,
            remainingAmount: true,
            originalAmount: true,
            themeColor: true,
        },
        orderBy: [{ inFridge: "desc" }, { remainingAmount: "desc" }],
    });

    return ingredients;
}

export async function getIngredient(id: number): Promise<Ingredient | null> {
    const ingr = await database.ingredient.findUnique({
        where: {
            id: id,
        },
        select: {
            id: true,
            imageUrl: true,
            inFridge: true,
            name: true,
            output: {
                select: {
                    id: true,
                    index: true,
                    name: true,
                },
            },
            usedInRecipe: {
                select: {
                    recipe: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            outputId: true,
            remainingAmount: true,
            originalAmount: true,
            themeColor: true,
        },
    });
    return ingr;
}

export async function updateIngredient(id: number, data: Partial<Ingredient>): Promise<Ingredient> {
    const ingr = await database.ingredient.update({
        where: {
            id: id,
        },
        data: {
            imageUrl: data.imageUrl,
            remainingAmount: data.remainingAmount,
            originalAmount: data.originalAmount,
            inFridge: data.inFridge,
            outputId: data.outputId,
            name: data.name,
            themeColor: data.themeColor,
        },
    });
    return {
        id: ingr.id,
        name: ingr.name,
        inFridge: ingr.inFridge,
        remainingAmount: ingr.remainingAmount,
        originalAmount: ingr.originalAmount,
        output: null,
        outputId: null,
        imageUrl: ingr.imageUrl,
        themeColor: ingr.themeColor,
    };
}

export async function deleteIngredient(id: number) {
    try {
        await database.ingredient.delete({
            where: {
                id: id,
            },
        });
        return true;
    } catch (ex) {
        console.error("Could not delete ingredient", ex);
        return false;
    }
}

export async function createIngredient(): Promise<Ingredient> {
    const ingr = await database.ingredient.create({
        data: {
            name: "",
            inFridge: true,
            remainingAmount: 1000,
        },
    });
    return {
        id: ingr.id,
        name: ingr.name,
        inFridge: ingr.inFridge,
        remainingAmount: ingr.remainingAmount,
        originalAmount: ingr.originalAmount,
        output: null,
        outputId: null,
        imageUrl: ingr.imageUrl,
        themeColor: ingr.themeColor,
    };
}

export async function getRecipe(id: number): Promise<Recipe | null> {
    return await database.recipe.findUnique({
        where: {
            id: id,
        },
        select: {
            id: true,
            description: true,
            imageUrl: true,
            name: true,
            themeColor: true,
            shown: true,
            ingredients: {
                select: {
                    amount: true,
                    order: true,
                    ingredientId: true,
                    ingredient: {
                        select: {
                            id: true,
                            imageUrl: true,
                            inFridge: true,
                            name: true,
                            remainingAmount: true,
                            originalAmount: true,
                            outputId: true,
                            themeColor: true,
                        },
                    },
                },
            },
        },
    });
}

export async function getRecipes(all: boolean): Promise<Recipe[]> {
    const rec = await database.recipe.findMany({
        select: {
            id: true,
            description: true,
            imageUrl: true,
            name: true,
            themeColor: true,
            shown: true,
            ingredients: {
                select: {
                    amount: true,
                    order: true,
                    ingredientId: true,
                    ingredient: {
                        select: {
                            id: true,
                            imageUrl: true,
                            inFridge: true,
                            name: true,
                            remainingAmount: true,
                            originalAmount: true,
                            outputId: true,
                            themeColor: true,
                        },
                    },
                },
            },
        },
        orderBy: [{ shown: "desc" }, { name: "asc" }],
        where: all
            ? undefined
            : {
                  shown: true,
                  ingredients: {
                      every: {
                          ingredient: {
                              inFridge: true,
                          },
                      },
                  },
              },
    });
    return rec;
}

export async function createRecipe(): Promise<Recipe> {
    const rec = await database.recipe.create({
        data: {
            name: "",
            description: "",
            themeColor: "#ff0000",
            shown: true,
        },
        select: {
            id: true,
            description: true,
            imageUrl: true,
            name: true,
            themeColor: true,
            shown: true,
            ingredients: {
                select: {
                    amount: true,
                    order: true,
                    ingredientId: true,
                    ingredient: {
                        select: {
                            id: true,
                            imageUrl: true,
                            inFridge: true,
                            name: true,
                            remainingAmount: true,
                            originalAmount: true,
                            outputId: true,
                            themeColor: true,
                        },
                    },
                },
            },
        },
    });
    return rec;
}

export async function updateRecipe(id: number, data: Partial<Recipe>): Promise<Recipe> {
    // const toCreate = (data.ingredients ?? []).

    if (data.ingredients) {
        const dataIngr = data.ingredients.filter((e) => e.ingredientId !== null);

        const existingIngr = await database.recipeIngredient.findMany({
            where: {
                recipeId: id,
            },
        });

        const toRemove = new Set(existingIngr.map((e) => e.ingredientId));
        (dataIngr ?? []).forEach((e) => toRemove.delete(e.ingredientId!));
        for (const ingrId of toRemove) {
            await database.recipeIngredient.delete({
                where: {
                    recipeId_ingredientId: {
                        ingredientId: ingrId,
                        recipeId: id,
                    },
                },
            });
        }

        const toAdd = new Map(dataIngr.map((e) => [e.ingredientId, e]));
        existingIngr.forEach((e) => toAdd.delete(e.ingredientId));
        for (const [ingrId, ingr] of toAdd) {
            await database.recipeIngredient.create({
                data: {
                    ingredientId: ingrId!,
                    recipeId: id,
                    amount: ingr.amount,
                    order: ingr.order,
                },
            });
        }

        for (const ingr of dataIngr) {
            await database.recipeIngredient.update({
                where: {
                    recipeId_ingredientId: {
                        ingredientId: ingr.ingredientId!,
                        recipeId: id,
                    },
                },
                data: {
                    amount: ingr.amount,
                    order: ingr.order,
                },
            });
        }
    }

    return await database.recipe.update({
        where: {
            id: id,
        },
        data: {
            description: data.description,
            name: data.name,
            imageUrl: data.imageUrl,
            themeColor: data.themeColor,
            shown: data.shown,
        },
        select: {
            id: true,
            description: true,
            imageUrl: true,
            name: true,
            themeColor: true,
            shown: true,
            ingredients: {
                select: {
                    amount: true,
                    order: true,
                    ingredientId: true,
                    ingredient: {
                        select: {
                            id: true,
                            imageUrl: true,
                            inFridge: true,
                            name: true,
                            remainingAmount: true,
                            originalAmount: true,
                            outputId: true,
                            themeColor: true,
                        },
                    },
                },
            },
        },
    });

    // for (let ingr of data.ingredients ?? []) {
    //     await database.recipeIngredient.upsert({
    //         where: {
    //             recipeId_ingredientId: {
    //                 ingredientId: ingr.ingredientId,
    //                 recipeId: id,
    //             },
    //         },
    //     });
    // }
}

export async function deleteRecipe(id: number) {
    await database.recipe.delete({
        where: {
            id: id,
        },
    });
}
