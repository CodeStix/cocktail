import { PrismaClient } from "@prisma/client";
import chalk from "chalk";
import { Ingredient, Output } from "cocktail-shared";

export const database = new PrismaClient();

let cachedOutputs: Output[] | null = null;

export async function getAllOutputs(): Promise<Output[]> {
    if (cachedOutputs == null) {
        cachedOutputs = await database.output.findMany();
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

export async function updateOutput(id: number, values: { name?: string; index?: number }) {
    await database.output.update({
        where: {
            id: id,
        },
        data: values,
    });
    cachedOutputs = null;
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
            outputId: true,
            remainingAmount: true,
        },
    });

    return ingredients;
}

export async function updateIngredient(id: number, data: Partial<Ingredient>): Promise<Ingredient> {
    const ingr = await database.ingredient.update({
        where: {
            id: id,
        },
        data: {
            imageUrl: data.imageUrl,
            remainingAmount: data.remainingAmount,
            inFridge: data.inFridge,
            outputId: data.outputId,
            name: data.name,
        },
    });
    return {
        id: ingr.id,
        name: ingr.name,
        inFridge: ingr.inFridge,
        remainingAmount: ingr.remainingAmount,
        output: null,
        outputId: null,
        imageUrl: null,
    };
}

export async function deleteIngredient(id: number) {
    await database.ingredient.delete({
        where: {
            id: id,
        },
    });
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
        output: null,
        outputId: null,
        imageUrl: null,
    };
}
