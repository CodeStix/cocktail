import i2c from "i2c-bus";
import { PCF8575Driver, RelayDriver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";
import { digitalRead, digitalWrite, pinMode, PinMode, pullUpDnControl, PullUpDownMode } from "tinker-gpio";
import chalk from "chalk";
import { CounterDriver } from "./counter";
import { EventEmitter } from "events";
import { DispenseSequence, Ingredient, Output } from "cocktail-shared";
import assert from "assert";

const BUTTON_PINS = [15, 16, 1, 6, 10, 26];
const WASTE_DETECTOR_PIN = 27;

const VALVE_WATER_MAIN = 13;
// const VALVE_WATER_WASTE = 1;
const VALVE_ROOM_TEMP_WATER = 12;
const VALVE_COLD_WATER = 11;
const VALVE_SPARKLING_WATER = 10;
const WASTE_PUMP = 14;

const RED_BUTTON = 0;
const BLUE_BUTTON = 1;
const WHITE_BUTTON = 2;
const YELLOW_BUTTON = 3;
const GREEN_BUTTON = 4;
const POWER_BUTTON = 5;

const FRAMES_PER_SECOND = 120;

const FLOW_SENSOR_ROTATIONS_PER_LITER = 346;

enum State {
    IDLE,
    SLEEP,
    CLEAN,
    BEFORE_DISPENSE,
    DISPENSE,
    AFTER_DISPENSE,
    // DISPENSE_ON_DEMAND,
    // SODA_WATER,
    // CLEAN,
    // DRINKING_MODE = 1,
    // CLEAN_MODE = 2,
}

// const BUTTON_DISPENSE = 2;
// const BUTTON_SPARKLING_WATER = 3;
// const BUTTON_COLD_WATER = 4;
// const BUTTON_ROOM_TEMP_WATER = 1;
// const BUTTON_SODA = 0;

// export interface CocktailMachineOutput {
//     index: number;
//     mlPerSecond: number | "use-counter";
//     remainingMl: number;
// }

function interactableLedAnimation(time: number) {
    return Math.sin(time / 250) / 3 + 0.66;
}

function activeLedAnimation(time: number) {
    return Math.sin(time / 100) / 2 + 0.5;
}

function blinkingLedAnimation(time: number) {
    return Math.floor(time / 500) % 2 == 0 ? 1 : 0;
}

function disabledLedAnimation(time: number) {
    return 0.01;
}

function inactiveLedAnimation(time: number) {
    return 0;
}

export type CocktailMachineCommand =
    | {
          type: "prepare-dispense";
          dispenseSequence: DispenseSequence;
          holdToDispense?: boolean;
      }
    | {
          type: "full-clean";
          thoroughly: boolean;
      }
    | {
          type: "stop-dispense";
      };

export class CocktailMachine extends EventEmitter {
    idleFullCleanInterval = 60 * 60;
    afterCleanPumpTime = 0.4;
    gotoSleepTimeout = 60 * 5;
    fastCleanSeconds = 0.25;
    pumpWasteTime = 10;
    beforeDispenseTimeout = 40;
    afterDispenseTimeout = 15;
    prepareDispenseTime = 0.7;

    private _relay12v!: PCF8575Driver;
    private _relay24v!: PCF8575Driver;
    private ads!: ADS1115;
    relays!: RelayDriver;
    private led!: PCA9685Driver;
    private flowCounter!: CounterDriver;

    private state = State.IDLE;

    private command: CocktailMachineCommand | null = null;
    // private outputs: Output[] = [];

    // Clean state
    private dirtyOutputs = new Map<number, Output>();
    private currentlyCleaningOutput: Output | null = null;
    private isThoroughClean = true;
    private cleanNextOutputAt = 0;
    private stopCleanAt = Number.MAX_SAFE_INTEGER;

    // Dispense state
    private dispenseSequence: DispenseSequence = [];
    private dispenseSequenceIndex = 0;
    private holdToDispense = false;

    private nextFullCleanAt = Number.MAX_SAFE_INTEGER;
    private gotoSleepAt = Number.MAX_SAFE_INTEGER;
    private dispenseTimeoutAt = Number.MAX_SAFE_INTEGER;
    private stopDispensePrepareAt = Number.MAX_SAFE_INTEGER;

    private lastEventLoopTimeMs = new Date().getTime();
    private stopPumpingWasteAt = Number.MAX_SAFE_INTEGER;
    private measurePressureAt = 0;
    private lastPressureMeasurement = 0;

    getIngredientById: (id: number) => Promise<Ingredient | null>;
    getAllOutputs: () => Promise<Output[]>;

    constructor(
        private bus: i2c.PromisifiedBus,
        getIngredientById: (id: number) => Promise<Ingredient | null>,
        getAllOutputs: () => Promise<Output[]>
    ) {
        super();
        this.getIngredientById = getIngredientById;
        this.getAllOutputs = getAllOutputs;

        const time = new Date().getTime() / 1000;
        this.nextFullCleanAt = time + this.idleFullCleanInterval;
        this.gotoSleepAt = time + this.gotoSleepTimeout;
    }

    executeCommand(command: CocktailMachineCommand) {
        if (this.command != null) {
            console.error(chalk.red(`A new command is being set (${command.type}) while another one wasn't processed yet (${this.command.type})`));
        }
        this.command = command;
    }

    private popCommand() {
        if (this.command === null) return null;
        let command = this.command;
        console.log(chalk.green("Processing command", command.type));
        this.command = null;
        return command;
    }

    public async initialize() {
        console.time(chalk.green("Setup GPIO driver"));
        BUTTON_PINS.forEach((e) => {
            pinMode(e, PinMode.INPUT);
            pullUpDnControl(e, PullUpDownMode.UP);
        });
        pinMode(WASTE_DETECTOR_PIN, PinMode.INPUT);
        pullUpDnControl(WASTE_DETECTOR_PIN, PullUpDownMode.UP);
        console.timeEnd(chalk.green("Setup GPIO driver"));

        console.time(chalk.green("Setup PWM driver"));
        this.led = new PCA9685Driver(this.bus, 0x40);
        await this.led.initialize();
        console.timeEnd(chalk.green("Setup PWM driver"));

        console.time(chalk.green("Setup GPIO expander driver 24v"));
        this._relay24v = new PCF8575Driver(this.bus, 32);
        console.timeEnd(chalk.green("Setup GPIO expander driver 24v"));

        console.time(chalk.green("Setup GPIO expander driver 12v"));
        this._relay12v = new PCF8575Driver(this.bus, 33);
        console.timeEnd(chalk.green("Setup GPIO expander driver 12v"));
        this.relays = new RelayDriver([this._relay12v, this._relay24v]);
        await this.relays.clearAll();

        console.time(chalk.green("Setup ADS driver"));
        this.ads = new ADS1115(this.bus, 0x48);
        await this.ads.initialize();
        console.timeEnd(chalk.green("Setup ADS driver"));

        console.time(chalk.green("Setup flow driver"));
        this.flowCounter = new CounterDriver(this.bus, 0x33);
        console.timeEnd(chalk.green("Setup flow driver"));

        void this.ledDriverLoop();
        void this.eventLoop();
    }

    // private getOutputById(id: number) {
    //     const output = this.outputs.find((e) => e.id === id);
    //     if (!output) throw new Error("Output with id not found " + id);
    //     return output;
    // }

    getDispenseSequence() {
        return this.dispenseSequence;
    }

    getLastPressureMeasurement() {
        return this.lastPressureMeasurement;
    }

    private async ledDriverLoop() {
        console.log(chalk.green("Led driver loop started"));

        while (true) {
            const timeMs = new Date().getTime();
            try {
                switch (this.state) {
                    case State.IDLE: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            await this.led.setDutyCycle(i, interactableLedAnimation(timeMs + 200 * i));
                        }
                        break;
                    }

                    case State.SLEEP: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            await this.led.setDutyCycle(i, disabledLedAnimation(timeMs));
                        }
                        break;
                    }

                    case State.BEFORE_DISPENSE: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            if (i === WHITE_BUTTON && this.stopDispensePrepareAt === Number.MAX_SAFE_INTEGER) {
                                await this.led.setDutyCycle(i, blinkingLedAnimation(timeMs));
                            } else if (i == RED_BUTTON) {
                                await this.led.setDutyCycle(i, interactableLedAnimation(timeMs));
                            } else {
                                await this.led.setDutyCycle(i, inactiveLedAnimation(timeMs));
                            }
                        }
                        break;
                    }

                    case State.DISPENSE: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            if (i === WHITE_BUTTON) {
                                await this.led.setDutyCycle(i, activeLedAnimation(timeMs));
                            } else if (i == RED_BUTTON) {
                                await this.led.setDutyCycle(i, interactableLedAnimation(timeMs));
                            } else {
                                await this.led.setDutyCycle(i, inactiveLedAnimation(timeMs));
                            }
                        }
                        break;
                    }

                    case State.AFTER_DISPENSE: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            if (i === GREEN_BUTTON || i == RED_BUTTON) {
                                await this.led.setDutyCycle(i, interactableLedAnimation(timeMs));
                            } else {
                                await this.led.setDutyCycle(i, inactiveLedAnimation(timeMs));
                            }
                        }
                        break;
                    }

                    case State.CLEAN: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            await this.led.setDutyCycle(i, disabledLedAnimation(timeMs));
                        }
                        break;
                    }

                    // case State.CLEAN: {
                    //     for (let i = 0; i < BUTTON_PINS.length; i++) {
                    //         let value = Math.sin(now / 100) / 2 + 0.5;
                    //         await this.led.setDutyCycle(i, i === BUTTON_CLEAN ? value : 0);
                    //     }
                    //     break;
                    // }

                    default: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            await this.led.setDutyCycle(i, 0);
                        }
                        break;
                    }
                }
            } catch (ex) {
                console.error("Error in led driver", ex);
            } finally {
                await new Promise((e) => setTimeout(e, 1000 / FRAMES_PER_SECOND));
            }
        }
    }

    // cleanOutputs(indices: number[]) {
    //     this.currentlyCleaningOutputIndex
    //     this.transitionState()
    // }

    private async dispenseSequenceContainsOutput(outputId: number): Promise<boolean> {
        for (const seq of this.dispenseSequence) {
            for (const part of seq.ingredients) {
                const ingr = await this.getIngredientById(part.ingredientId);
                if (ingr!.outputId === outputId) {
                    return true;
                }
            }
        }
        return false;
    }

    private async transitionState(newState: State) {
        console.log(chalk.bold(chalk.cyan(`Transition to ${State[newState]}`)));

        const time = new Date().getTime() / 1000;
        try {
            if (this.state !== State.CLEAN && this.state !== State.IDLE) {
                this.gotoSleepAt = time + this.gotoSleepTimeout;
            }

            switch (newState) {
                case State.IDLE: {
                    await this.relays.clearAllGpio();
                    break;
                }

                case State.SLEEP: {
                    await this.relays.clearAllGpio();
                    break;
                }

                case State.CLEAN: {
                    // await this.relays.clearAllGpio();
                    this.currentlyCleaningOutput = null;

                    for (const output of await this.getAllOutputs()) {
                        if (output.settings.requiredWhenCleaning ?? false) {
                            await this.relays.setGpio(output.index, true);
                            this.dirtyOutputs.delete(output.index);
                        } else {
                            await this.relays.setGpio(output.index, false);
                        }
                    }

                    this.stopCleanAt = Number.MAX_SAFE_INTEGER;
                    this.cleanNextOutputAt = 1000;
                    break;
                }

                case State.BEFORE_DISPENSE: {
                    this.emit("dispense-progress", {
                        progress: 0,
                        status: "waiting",
                    });

                    let anyOutputWantsPrepare = false;
                    for (const output of await this.getAllOutputs()) {
                        const prepareOutput =
                            (output.settings.prepareBeforeDispense ?? false) && (await this.dispenseSequenceContainsOutput(output.id));
                        if (prepareOutput) {
                            anyOutputWantsPrepare = true;
                        }

                        if ((output.settings.requiredWhenDispensing ?? false) || prepareOutput) {
                            await this.relays.setGpio(output.index, true);
                        } else {
                            await this.relays.setGpio(output.index, false);
                        }
                    }

                    if (anyOutputWantsPrepare && (this.state === State.SLEEP || this.state === State.IDLE)) {
                        this.stopDispensePrepareAt = time + this.prepareDispenseTime;
                    } else {
                        this.stopDispensePrepareAt = Number.MAX_SAFE_INTEGER;
                    }

                    this.dispenseTimeoutAt = time + this.beforeDispenseTimeout;

                    break;
                }

                case State.DISPENSE: {
                    this.emit("dispense-progress", {
                        progress: 0,
                        status: "dispensing",
                    });

                    for (const seq of this.dispenseSequence) {
                        for (const output of seq.ingredients) {
                            output.remainingMl = output.startingMl;
                        }
                    }

                    for (const output of await this.getAllOutputs()) {
                        if (output.settings.requiredWhenDispensing ?? false) {
                            await this.relays.setGpio(output.index, true);
                        } else {
                            await this.relays.setGpio(output.index, false);
                        }
                    }

                    this.dispenseSequenceIndex = -1;
                    break;
                }

                case State.AFTER_DISPENSE: {
                    this.emit("dispense-progress", {
                        status: "done",
                    });

                    for (const output of await this.getAllOutputs()) {
                        if (output.settings.requiredWhenDispensing ?? false) {
                            await this.relays.setGpio(output.index, true);
                        } else {
                            await this.relays.setGpio(output.index, false);
                        }
                    }

                    this.dispenseTimeoutAt = time + this.afterDispenseTimeout;
                    break;
                }

                default: {
                    console.warn(chalk.red(`No transition implemented for ${State[newState]}`));
                    break;
                }
            }

            this.emit("state-change", {
                from: State[this.state],
                to: State[newState],
            });

            this.state = newState;
        } catch (ex) {
            console.error(chalk.bold(chalk.red(`Could not transition to ${State[newState]}`, ex)));
        }
    }

    private async transitionToClean(opts: { isThoroughClean: boolean; cleanAll: boolean }) {
        this.isThoroughClean = opts.isThoroughClean;
        if (opts.cleanAll) {
            const outputs = await this.getAllOutputs();
            // console.log("clean", outputs.length);
            // outputs
            //     .filter((e) => e.settings.includeInFullClean ?? false)
            //     .forEach((e) => console.log("clean output", e.id, e.name, JSON.stringify(e.settings)));
            outputs.filter((e) => e.settings.includeInFullClean ?? false).forEach((e) => this.dirtyOutputs.set(e.index, e));
        }

        if (this.dirtyOutputs.size > 0) {
            await this.transitionState(State.CLEAN);
        } else {
            await this.transitionState(State.IDLE);
        }
    }

    private async eventLoop() {
        console.log(chalk.green("Event loop started"));

        let prevButtonStates = BUTTON_PINS.map(() => false);
        let prevLiters = 0;

        while (true) {
            const timeMs = new Date().getTime();
            const time = timeMs / 1000;
            const deltaTime = (timeMs - this.lastEventLoopTimeMs) / 1000;
            this.lastEventLoopTimeMs = timeMs;

            try {
                let buttonStates = BUTTON_PINS.map((e) => !digitalRead(e));
                let changedButtons = buttonStates.map((s, i) => s !== prevButtonStates[i]);
                buttonStates.forEach((e, i) => (prevButtonStates[i] = e));

                // if (digitalRead(WASTE_DETECTOR_PIN)) {
                //     if (this.wasteFullDetectedTime === 0) {
                //         console.log("Waste was detected for the first time");
                //     }
                //     this.wasteFullDetectedTime += deltaTime;
                // } else {
                //     this.wasteFullDetectedTime = 0;
                // }

                if (false && digitalRead(WASTE_DETECTOR_PIN)) {
                    if (this.stopPumpingWasteAt === Number.MAX_SAFE_INTEGER) {
                        console.log(chalk.magenta("Start pumping waste!"));
                        for (const output of (await this.getAllOutputs()).filter((e) => e.settings.enableWhenWasteFull ?? false)) {
                            await this.relays.setGpio(output.index, true);
                        }
                    }

                    this.stopPumpingWasteAt = time + this.pumpWasteTime;
                }

                if (time > this.stopPumpingWasteAt) {
                    console.log(chalk.magenta("Stop pumping waste!"));
                    this.stopPumpingWasteAt = Number.MAX_SAFE_INTEGER;

                    for (const output of (await this.getAllOutputs()).filter((e) => e.settings.enableWhenWasteFull ?? false)) {
                        await this.relays.setGpio(output.index, false);
                    }
                }

                if (time > this.measurePressureAt) {
                    this.lastPressureMeasurement = await this.ads.analogRead(0);
                    this.measurePressureAt = time + 0.5;
                    this.emit("pressure-measurement", this.lastPressureMeasurement);
                }

                // for (let i = 0; i < changedButtons.length; i++) {
                //     if (changedButtons[i]) {
                //         console.log(chalk.gray(`Button ${i} changed -> ${buttonStates[i]}`));
                //         if (buttonStates[i]) {
                //             this.emit("buttonPress", i);
                //         } else {
                //             this.emit("buttonRelease", i);
                //         }
                //     }
                // }

                let flow = await this.flowCounter.getCounter();
                let liters = flow / FLOW_SENSOR_ROTATIONS_PER_LITER;
                let deltaLiters = Math.max(liters - prevLiters, 0);

                if (liters !== prevLiters) {
                    console.log(chalk.gray("Liters: %d l"), liters);
                    prevLiters = liters;
                }

                switch (this.state) {
                    case State.SLEEP:
                    case State.IDLE: {
                        if (time > this.nextFullCleanAt) {
                            this.nextFullCleanAt = time + this.idleFullCleanInterval;
                            await this.transitionToClean({
                                isThoroughClean: false,
                                cleanAll: true,
                            });
                            break;
                        }

                        if (this.state == State.IDLE) {
                            if (time > this.gotoSleepAt) {
                                await this.transitionState(State.SLEEP);
                                break;
                            }

                            if (changedButtons[POWER_BUTTON] && buttonStates[POWER_BUTTON]) {
                                await this.transitionState(State.SLEEP);
                                break;
                            }
                        } else {
                            if (changedButtons.some((e) => e) && buttonStates.some((e) => e)) {
                                await this.transitionState(State.IDLE);
                                break;
                            }
                        }

                        const cmd = this.popCommand();
                        if (cmd != null) {
                            switch (cmd.type) {
                                case "prepare-dispense": {
                                    this.dispenseSequence = cmd.dispenseSequence;
                                    this.holdToDispense = cmd.holdToDispense ?? false;
                                    await this.transitionState(State.BEFORE_DISPENSE);
                                    break;
                                }
                                case "full-clean": {
                                    this.nextFullCleanAt = time + this.idleFullCleanInterval;
                                    await this.transitionToClean({
                                        cleanAll: true,
                                        isThoroughClean: cmd.thoroughly,
                                    });
                                    break;
                                }
                            }
                        }

                        // console.log("Pressure", await this.ads.analogRead(0));

                        break;
                    }

                    // case State.SLEEP: {
                    //     if (time > this.nextFullCleanAt) {
                    //         this.nextFullCleanAt = time + this.idleFullCleanInterval;
                    //         await this.transitionToClean({
                    //             isThoroughClean: false,
                    //             cleanAll: true,
                    //         });
                    //         break;
                    //     }

                    //     if (changedButtons.some((e) => e) && buttonStates.some((e) => e)) {
                    //         await this.transitionState(State.IDLE);
                    //         break;
                    //     }

                    //     break;
                    // }

                    case State.CLEAN: {
                        if (time > this.cleanNextOutputAt) {
                            if (this.currentlyCleaningOutput !== null) {
                                console.log("%d: Clean disable %d", time, this.currentlyCleaningOutput.index);
                                await this.relays.setGpio(this.currentlyCleaningOutput.index, false);
                            }

                            if (this.dirtyOutputs.size <= 0) {
                                // Done cleaning
                                this.cleanNextOutputAt = Number.MAX_SAFE_INTEGER;
                                this.stopCleanAt = time + this.afterCleanPumpTime;
                                break;
                            }

                            this.currentlyCleaningOutput = Array.from(this.dirtyOutputs.values())[0];
                            this.dirtyOutputs.delete(this.currentlyCleaningOutput.index);
                            console.log("%d: Clean enable %d", time, this.currentlyCleaningOutput.index);
                            await this.relays.setGpio(this.currentlyCleaningOutput.index, true);

                            const cleanOutputTime = this.isThoroughClean
                                ? this.currentlyCleaningOutput.settings.cleanSeconds ?? 0.5
                                : this.fastCleanSeconds;
                            this.cleanNextOutputAt = time + cleanOutputTime;
                        }

                        if (time > this.stopCleanAt) {
                            await this.transitionState(State.IDLE);
                            break;
                        }

                        break;
                    }

                    case State.BEFORE_DISPENSE: {
                        const command = this.popCommand();
                        if (command?.type == "prepare-dispense") {
                            this.dispenseSequence = command.dispenseSequence;
                            this.holdToDispense = command.holdToDispense ?? false;
                            this.dispenseTimeoutAt = time + this.beforeDispenseTimeout;
                        }

                        if (time > this.stopDispensePrepareAt) {
                            this.stopDispensePrepareAt = Number.MAX_SAFE_INTEGER;
                            console.log(chalk.gray("Stop dispense prepare, ready for dispense"));
                            for (const output of await this.getAllOutputs()) {
                                if (output.settings.prepareBeforeDispense ?? false) {
                                    await this.relays.setGpio(output.index, false);
                                }
                            }
                        }

                        if (this.stopDispensePrepareAt === Number.MAX_SAFE_INTEGER && changedButtons[WHITE_BUTTON] && buttonStates[WHITE_BUTTON]) {
                            await this.transitionState(State.DISPENSE);
                            break;
                        }

                        if (
                            (changedButtons[RED_BUTTON] && buttonStates[RED_BUTTON]) ||
                            time > this.dispenseTimeoutAt ||
                            command?.type === "stop-dispense"
                        ) {
                            await this.transitionToClean({
                                isThoroughClean: true,
                                cleanAll: false,
                            });
                            break;
                        }

                        break;
                    }

                    case State.DISPENSE: {
                        let gotoNextPart = true;
                        if (this.dispenseSequenceIndex >= 0) {
                            const part = this.dispenseSequence[this.dispenseSequenceIndex];
                            for (let i = 0; i < part.ingredients.length; i++) {
                                const partOut = part.ingredients[i];
                                // console.log(chalk.gray("Output remaining", partOut.outputId, partOut.remainingMl));
                                if (partOut.remainingMl > 0) {
                                    gotoNextPart = false;

                                    const ingr = await this.getIngredientById(partOut.ingredientId);
                                    assert(ingr);

                                    const mlPerSecond = ingr.output!.settings.mlPerSecond ?? 10;
                                    if (mlPerSecond === "use-counter") {
                                        partOut.remainingMl -= deltaLiters * 1000;
                                    } else {
                                        partOut.remainingMl -= mlPerSecond * deltaTime;
                                    }

                                    if (partOut.remainingMl <= 0) {
                                        await this.relays.setGpio(ingr.output!.index, false);
                                    }
                                }
                            }
                        }

                        if (gotoNextPart) {
                            this.dispenseSequenceIndex += 1;
                            if (this.dispenseSequenceIndex >= this.dispenseSequence.length) {
                                console.log(chalk.gray("Dispensing is done"));
                                // Dispense done!
                                if (!this.holdToDispense) {
                                    await this.transitionState(State.AFTER_DISPENSE);
                                } else {
                                    for (const seq of this.dispenseSequence) {
                                        for (const output of seq.ingredients) {
                                            output.remainingMl = output.startingMl;
                                        }
                                    }
                                    this.dispenseSequenceIndex = -1;
                                }
                                break;
                            } else {
                                console.log(
                                    chalk.gray("Next outputs in sequence", this.dispenseSequenceIndex + 1 + "/" + this.dispenseSequence.length)
                                );
                                const part = this.dispenseSequence[this.dispenseSequenceIndex];
                                for (let i = 0; i < part.ingredients.length; i++) {
                                    const partOut = part.ingredients[i];
                                    const ingr = await this.getIngredientById(partOut.ingredientId);
                                    assert(ingr);

                                    if ((ingr.output!.settings.cleanSeconds ?? 0.5) > 0) {
                                        this.dirtyOutputs.set(ingr.output!.index, ingr.output!);
                                    }
                                    await this.relays.setGpio(ingr.output!.index, true);
                                }
                            }
                        }

                        if (true) {
                            let totalMl = 0;
                            let totalRemainingMl = 0;
                            for (const output of this.dispenseSequence) {
                                for (const part of output.ingredients) {
                                    totalMl += part.startingMl;
                                    totalRemainingMl += part.remainingMl;
                                }
                            }
                            this.emit("dispense-progress", {
                                progress: (totalMl - totalRemainingMl) / totalMl,
                                status: "dispensing",
                            });
                        }

                        if (!this.holdToDispense) {
                            if (changedButtons[WHITE_BUTTON] && buttonStates[WHITE_BUTTON]) {
                                // Cancel dispense
                                await this.transitionState(State.AFTER_DISPENSE);
                                break;
                            }
                        } else {
                            if (!buttonStates[WHITE_BUTTON]) {
                                await this.transitionState(State.BEFORE_DISPENSE);
                                break;
                            }

                            // if (true) {
                            //     this.emit("dispense-progress", {
                            //         progress: 0.7,
                            //         status: "dispensing",
                            //     });
                            // }
                        }

                        if (changedButtons[RED_BUTTON] && buttonStates[RED_BUTTON]) {
                            // Cancel dispense
                            await this.transitionState(State.AFTER_DISPENSE);
                            break;
                        }

                        if (this.popCommand()?.type === "stop-dispense") {
                            // Stop
                            await this.transitionToClean({
                                isThoroughClean: true,
                                cleanAll: false,
                            });
                            break;
                        }

                        break;
                    }

                    case State.AFTER_DISPENSE: {
                        if (changedButtons[GREEN_BUTTON] && buttonStates[GREEN_BUTTON]) {
                            // Dispense same recipe again
                            await this.transitionState(State.BEFORE_DISPENSE);
                            break;
                        }

                        if (
                            (changedButtons[RED_BUTTON] && buttonStates[RED_BUTTON]) ||
                            time > this.dispenseTimeoutAt ||
                            this.popCommand()?.type === "stop-dispense"
                        ) {
                            // Stop
                            await this.transitionToClean({
                                isThoroughClean: true,
                                cleanAll: false,
                            });
                            break;
                        }
                        break;
                    }

                    // case State.DISPENSE_ON_DEMAND: {
                    //     const allIngr = this.dispenseSequence.flatMap((e) => e.ingredients);

                    //     let someLeft = false;
                    //     for (const partOut of allIngr) {
                    //         if (partOut.remainingMl <= 0) {
                    //             continue;
                    //         }

                    //         const ingr = await this.getIngredientById(partOut.ingredientId);
                    //         assert(ingr);

                    //         const mlPerSecond = ingr.output!.settings.mlPerSecond ?? 10;
                    //         if (mlPerSecond === "use-counter") {
                    //             partOut.remainingMl -= deltaLiters * 1000;
                    //         } else {
                    //             partOut.remainingMl -= mlPerSecond * deltaTime;
                    //         }

                    //         if (partOut.remainingMl <= 0) {
                    //             await this.relays.setGpio(ingr.output!.index, false);
                    //         }

                    //         someLeft = true;
                    //     }

                    //     if (!someLeft) {
                    //         // All ingredients have been dispensed
                    //     }
                    // }

                    default: {
                        console.warn(chalk.red(`No tick implemented for ${this.state}`));
                        break;
                    }
                }
            } catch (ex) {
                console.error("Error in event loop", ex);
            } finally {
                await new Promise((e) => setTimeout(e, 1000 / FRAMES_PER_SECOND));
            }
        }
    }
}
