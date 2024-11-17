import i2c from "i2c-bus";
import { PCF8575Driver, RelayDriver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";
import { digitalRead, digitalWrite, pinMode, PinMode, pullUpDnControl, PullUpDownMode } from "tinker-gpio";
import chalk from "chalk";
import { CounterDriver } from "./counter";
import { EventEmitter } from "events";
import { Output } from "cocktail-shared";

const BUTTON_PINS = [15, 16, 1, 6, 10, 31];

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
    return Math.sin(time / 250) / 4 + 0.75;
}

function activeLedAnimation(time: number) {
    return Math.sin(time / 100) / 2 + 0.5;
}

function blinkingLedAnimation(time: number) {
    return Math.floor(time / 1000) % 2 == 0 ? 1 : 0;
}

function disabledLedAnimation(time: number) {
    return 0.05;
}

function inactiveLedAnimation(time: number) {
    return 0;
}

export type CocktailMachineCommand =
    | {
          type: "prepare-dispense";
          dispenseSequence: {
              outputs: { outputId: number; startingMl: number; remainingMl: number }[];
          }[];
      }
    | {
          type: "full-clean";
          thoroughly: boolean;
      };

export class CocktailMachine extends EventEmitter {
    idleFullCleanInterval = 60 * 2;
    gotoSleepTimeout = 60 * 5;

    private _relay12v!: PCF8575Driver;
    private _relay24v!: PCF8575Driver;
    // private ads!: ADS1115;
    relays!: RelayDriver;
    private led!: PCA9685Driver;
    private flowCounter!: CounterDriver;

    private state = State.IDLE;

    private commandQueue: CocktailMachineCommand[] = [];
    // private outputs: Output[] = [];

    // Clean state
    private dirtyOutputs = new Set<Output>();
    private currentlyCleaningOutput: Output | null = null;
    private isThoroughClean = true;
    private cleanNextOutputAt = 0;

    // Dispense state
    private dispenseSequence!: {
        outputs: { outputId: number; startingMl: number; remainingMl: number }[];
    }[];
    private dispenseSequenceIndex = 0;

    private nextFullCleanAt = Number.MAX_SAFE_INTEGER;
    private gotoSleepAt = Number.MAX_SAFE_INTEGER;
    private afterDispenseExitAt = Number.MAX_SAFE_INTEGER;

    private lastEventLoopTimeMs = new Date().getTime();

    getOutputById: (id: number) => Promise<Output>;
    getAllOutputs: () => Promise<Output[]>;

    constructor(private bus: i2c.PromisifiedBus, getOutputById: (id: number) => Promise<Output>, getAllOutputs: () => Promise<Output[]>) {
        super();
        this.getOutputById = getOutputById;
        this.getAllOutputs = getAllOutputs;

        const time = new Date().getTime() / 1000;
        this.nextFullCleanAt = time + this.idleFullCleanInterval;
        this.gotoSleepAt = time + this.gotoSleepTimeout;
    }

    executeCommand(command: CocktailMachineCommand) {
        this.commandQueue.push(command);
    }

    public async initialize() {
        console.time(chalk.green("Setup GPIO driver"));
        BUTTON_PINS.forEach((e) => {
            pinMode(e, PinMode.INPUT);
            pullUpDnControl(e, PullUpDownMode.UP);
        });
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

        // console.time(chalk.green("Setup ADS driver"));
        // this.ads = new ADS1115(this.bus, 0x48);
        // await this.ads.initialize();
        // console.timeEnd(chalk.green("Setup ADS driver"));

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
                            if (i === WHITE_BUTTON || i == RED_BUTTON) {
                                await this.led.setDutyCycle(i, interactableLedAnimation(timeMs));
                            } else {
                                await this.led.setDutyCycle(i, inactiveLedAnimation(timeMs));
                            }
                        }
                        break;
                    }

                    case State.DISPENSE: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            let value = Math.sin(timeMs / 100) / 2 + 0.5;
                            if (i === WHITE_BUTTON) {
                                await this.led.setDutyCycle(i, activeLedAnimation(timeMs));
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

    private async transitionState(newState: State) {
        console.log(chalk.bold(chalk.cyan(`Transition to ${State[newState]}`)));

        const time = new Date().getTime() / 1000;
        try {
            if (this.state == State.CLEAN) {
                this.nextFullCleanAt = time + this.idleFullCleanInterval;
            }
            this.gotoSleepAt = time + this.gotoSleepTimeout;

            await this.relays.clearAllGpio();

            switch (newState) {
                case State.IDLE: {
                    break;
                }

                case State.SLEEP: {
                    break;
                }

                case State.CLEAN: {
                    this.currentlyCleaningOutput = null;

                    for (const output of await this.getAllOutputs()) {
                        if (output.settings.requiredWhenCleaning ?? false) {
                            await this.relays.setGpio(output.index, true);
                            this.dirtyOutputs.delete(output);
                        }
                    }

                    this.cleanNextOutputAt = 1000;
                    break;
                }

                case State.BEFORE_DISPENSE: {
                    this.emit("status-update", {
                        progress: 0,
                        status: "waiting",
                    });

                    break;
                }

                case State.DISPENSE: {
                    this.emit("status-update", {
                        progress: 0,
                        status: "dispensing",
                    });

                    for (const output of await this.getAllOutputs()) {
                        if (output.settings.requiredWhenDispensing ?? false) {
                            await this.relays.setGpio(output.index, true);
                        }
                    }

                    this.dispenseSequenceIndex = -1;
                    break;
                }

                case State.AFTER_DISPENSE: {
                    this.emit("status-update", {
                        status: "done",
                    });

                    this.afterDispenseExitAt = time + 20;
                    break;
                }

                default: {
                    console.warn(chalk.red(`No transition implemented for ${State[newState]}`));
                    break;
                }
            }

            this.state = newState;
        } catch (ex) {
            console.error(chalk.bold(chalk.red(`Could not transition to ${State[newState]}`, ex)));
        }
    }

    private async transitionToClean(opts: { isThoroughClean: boolean; cleanAll: boolean }) {
        this.isThoroughClean = opts.isThoroughClean;
        if (opts.cleanAll) {
            (await this.getAllOutputs()).filter((e) => e.settings.includeInFullClean ?? false).forEach((e) => this.dirtyOutputs.add(e));
        }
        await this.transitionState(State.CLEAN);
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
                    case State.IDLE: {
                        if (time > this.nextFullCleanAt) {
                            this.nextFullCleanAt = time + this.idleFullCleanInterval;
                            await this.transitionToClean({
                                isThoroughClean: false,
                                cleanAll: true,
                            });
                            break;
                        }

                        if (time > this.gotoSleepAt) {
                            await this.transitionState(State.SLEEP);
                            break;
                        }

                        if (changedButtons[POWER_BUTTON] && buttonStates[POWER_BUTTON]) {
                            await this.transitionState(State.SLEEP);
                            break;
                        }

                        if (this.commandQueue.length > 0) {
                            const cmd = this.commandQueue.shift()!;
                            this.commandQueue = [];
                            console.log("cmd", cmd);
                            switch (cmd.type) {
                                case "prepare-dispense": {
                                    this.dispenseSequence = cmd.dispenseSequence;
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

                        break;
                    }

                    case State.SLEEP: {
                        if (time > this.nextFullCleanAt) {
                            this.nextFullCleanAt = time + this.idleFullCleanInterval;
                            await this.transitionToClean({
                                isThoroughClean: false,
                                cleanAll: true,
                            });
                            break;
                        }

                        if (changedButtons.some((e) => e)) {
                            await this.transitionState(State.IDLE);
                            break;
                        }

                        break;
                    }

                    case State.CLEAN: {
                        if (time > this.cleanNextOutputAt) {
                            if (this.currentlyCleaningOutput !== null) {
                                await this.relays.setGpio(this.currentlyCleaningOutput.index, false);
                            }

                            if (this.dirtyOutputs.size <= 0) {
                                // Done cleaning
                                await this.transitionState(State.IDLE);
                                break;
                            }

                            this.currentlyCleaningOutput = Array.from(this.dirtyOutputs.values())[0];
                            this.dirtyOutputs.delete(this.currentlyCleaningOutput);
                            await this.relays.setGpio(this.currentlyCleaningOutput.index, true);

                            const cleanOutputTime = this.isThoroughClean ? this.currentlyCleaningOutput.settings.cleanSeconds ?? 0.5 : 0.4;
                            this.cleanNextOutputAt = time + cleanOutputTime;
                        }
                        break;
                    }

                    case State.BEFORE_DISPENSE: {
                        if (changedButtons[WHITE_BUTTON] && buttonStates[WHITE_BUTTON]) {
                            await this.transitionState(State.DISPENSE);
                            break;
                        }

                        if (changedButtons[RED_BUTTON] && buttonStates[RED_BUTTON]) {
                            this.emit("status-update", {
                                status: "return-to-idle",
                            });
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
                            console.log("Part", this.dispenseSequenceIndex);
                            const part = this.dispenseSequence[this.dispenseSequenceIndex];
                            for (let i = 0; i < part.outputs.length; i++) {
                                const partOut = part.outputs[i];
                                console.log("Part out", partOut.outputId, partOut.remainingMl, partOut.startingMl);
                                if (partOut.remainingMl > 0) {
                                    gotoNextPart = false;

                                    const output = await this.getOutputById(partOut.outputId);
                                    const mlPerSecond = output.settings.mlPerSecond ?? 10;
                                    if (mlPerSecond === "use-counter") {
                                        partOut.remainingMl -= deltaLiters * 1000;
                                    } else {
                                        partOut.remainingMl -= mlPerSecond * deltaTime;
                                    }

                                    if (partOut.remainingMl <= 0) {
                                        await this.relays.setGpio(output.index, false);
                                    }
                                }
                            }
                        }

                        if (gotoNextPart) {
                            this.dispenseSequenceIndex += 1;
                            if (this.dispenseSequenceIndex >= this.dispenseSequence.length) {
                                // Dispense done!
                                await this.transitionState(State.AFTER_DISPENSE);
                                break;
                            } else {
                                const part = this.dispenseSequence[this.dispenseSequenceIndex];
                                for (let i = 0; i < part.outputs.length; i++) {
                                    const partOut = part.outputs[i];
                                    const output = await this.getOutputById(partOut.outputId);
                                    this.dirtyOutputs.add(output);
                                    await this.relays.setGpio(output.index, true);
                                }
                            }
                        }

                        if (changedButtons[WHITE_BUTTON] && buttonStates[WHITE_BUTTON]) {
                            // Cancel dispense
                            await this.transitionState(State.AFTER_DISPENSE);
                            break;
                        }

                        if (true) {
                            let totalMl = 0;
                            let totalRemainingMl = 0;
                            for (const output of this.dispenseSequence) {
                                for (const part of output.outputs) {
                                    totalMl += part.startingMl;
                                    totalRemainingMl += part.remainingMl;
                                }
                            }
                            this.emit("status-update", {
                                progress: (totalMl - totalRemainingMl) / totalMl,
                                status: "dispensing",
                            });
                        }

                        break;
                    }

                    case State.AFTER_DISPENSE: {
                        if (changedButtons[GREEN_BUTTON] && buttonStates[GREEN_BUTTON]) {
                            // Dispense same recipe again
                            await this.transitionState(State.BEFORE_DISPENSE);
                            break;
                        }

                        if ((changedButtons[RED_BUTTON] && buttonStates[RED_BUTTON]) || time > this.afterDispenseExitAt) {
                            // Stop
                            this.emit("status-update", {
                                status: "return-to-idle",
                            });
                            await this.transitionToClean({
                                isThoroughClean: true,
                                cleanAll: false,
                            });
                            break;
                        }
                        break;
                    }

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
