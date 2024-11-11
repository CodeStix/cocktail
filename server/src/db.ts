import { PrismaClient } from "@prisma/client";
import chalk from "chalk";
import { Output } from "cocktail-shared";
import fs from "fs";

// let functionToRelayIndex: Record<OutputFunction, number>;
// let relayIndexToFunction: Record<number, OutputFunction>;

// export enum OutputFunction {
//     None = 0,

//     MainWater = 1,
//     WastePump,
//     NormalWater,
//     ColdWater,
//     SparkingWater,

//     PumpV1_0 = 100,
//     PumpV1_1,
//     PumpV1_2,
//     PumpV1_3,
//     PumpV1_4,

//     PumpV2_0 = 200,
//     PumpV2_1,
//     PumpV2_2,
//     PumpV2_3,
//     PumpV2_4,
//     PumpV2_5,
//     PumpV2_6,
// }

// const RELAY_FUNC_FILE = "outputs.json";

// export function getRelayIdxForFunction(fn: OutputFunction) {
//     if (!(fn in functionToRelayIndex)) {
//         throw new Error("No relay available for" + fn);
//     }
//     return functionToRelayIndex[fn];
// }

// export function getFunctionForRelayIdx(idx: number): OutputFunction {
//     if (!(idx in relayIndexToFunction)) {
//         return OutputFunction.None;
//     }
//     return relayIndexToFunction[idx];
//     // let res = Object.entries(functionToRelayIndex).find(([, { index }]) => index === idx);
//     // if (!res) {
//     //     return OutputFunction.None;
//     // }
//     // return OutputFunction[res[0] as keyof typeof OutputFunction];
// }

// export function setRelayFunction(fn: OutputFunction, relayIdx: number, save = true) {
//     functionToRelayIndex[fn] = relayIdx;
//     relayIndexToFunction[relayIdx] = fn;
//     if (save) saveRelayFunctions();
// }

// export function loadRelayFunctions() {
//     functionToRelayIndex = {} as any;
//     relayIndexToFunction = {} as any;

//     if (fs.existsSync(RELAY_FUNC_FILE)) {
//         const str = fs.readFileSync(RELAY_FUNC_FILE, "utf-8");
//         let rec: Record<string, number> = JSON.parse(str);

//         for (const [k, v] of Object.entries(rec)) {
//             functionToRelayIndex[OutputFunction[k as keyof typeof OutputFunction]] = v;
//             relayIndexToFunction[v] = OutputFunction[k as keyof typeof OutputFunction];
//         }
//     } else {
//         console.warn(chalk.yellow("No relay function mapping file exists, creating..."));
//         saveRelayFunctions();
//     }
// }

// export function saveRelayFunctions() {
//     let rec: Record<string, number> = {};
//     for (const [k, v] of Object.entries(functionToRelayIndex)) {
//         rec[OutputFunction[k as keyof typeof OutputFunction]] = v;
//     }
//     fs.writeFileSync(RELAY_FUNC_FILE, JSON.stringify(rec, null, 2));
// }

// loadRelayFunctions();

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
