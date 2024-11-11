import chalk from "chalk";
import fs from "fs";

type OutputFunctionPerRelay = {
    [T in OutputFunction]?: {
        index: number;
    };
};

let relayConfig: OutputFunctionPerRelay = {};

export enum OutputFunction {
    None = 0,

    MainWater = 1,
    WastePump,
    NormalWater,
    ColdWater,
    SparkingWater,

    PumpV1_0 = 100,
    PumpV1_1,
    PumpV1_2,
    PumpV1_3,
    PumpV1_4,

    PumpV2_0 = 200,
    PumpV2_1,
    PumpV2_2,
    PumpV2_3,
    PumpV2_4,
    PumpV2_5,
    PumpV2_6,
}

const RELAY_FUNC_FILE = "outputs.json";

export function getRelayIdxForFunction(fn: OutputFunction) {
    return relayConfig[fn];
}

export function getFunctionForRelayIdx(idx: number): OutputFunction {
    let res = Object.entries(relayConfig).find(([, { index }]) => index === idx);
    if (!res) {
        return OutputFunction.None;
    }
    return OutputFunction[res[0] as keyof typeof OutputFunction];
}

export function setRelayFunction(fn: OutputFunction, relayIdx: number, save = true) {
    relayConfig[fn] = {
        index: relayIdx,
    };
    if (save) saveRelayFunctions();
}

export function loadRelayFunctions() {
    if (fs.existsSync(RELAY_FUNC_FILE)) {
        const str = fs.readFileSync(RELAY_FUNC_FILE, "utf-8");
        relayConfig = JSON.parse(str);
    } else {
        console.warn(chalk.yellow("No relay function mapping file exists, creating..."));
        relayConfig = {};
        saveRelayFunctions();
    }
}

export function saveRelayFunctions() {
    fs.writeFileSync(RELAY_FUNC_FILE, JSON.stringify(relayConfig, null, 2));
}

loadRelayFunctions();
