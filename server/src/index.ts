import i2c from "i2c-bus";
import { PCF8575Driver, RelayDriver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";
import { digitalRead, digitalWrite, pinMode, PinMode, pullUpDnControl, PullUpDownMode } from "tinker-gpio";
import chalk from "chalk";
import { CounterDriver } from "./counter";

const BUTTON_PINS = [15, 16, 1, 6, 10, 31];

const VALVE_WATER_MAIN = 13;
// const VALVE_WATER_WASTE = 1;
const VALVE_ROOM_TEMP_WATER = 12;
const VALVE_COLD_WATER = 11;
const VALVE_SPARKLING_WATER = 10;
const WASTE_PUMP = 14;

const FRAMES_PER_SECOND = 120;

const FLOW_SENSOR_ROTATIONS_PER_LITER = 346;

enum State {
    IDLE = 0,
    COLD_WATER = 1,
    SPARKLING_WATER = 2,
    ROOM_TEMP_WATER = 3,
    SODA = 4,
    // SODA_WATER,
    // CLEAN,
    // DRINKING_MODE = 1,
    // CLEAN_MODE = 2,
}

let state = State.IDLE;

const BUTTON_DISPENSE = 2;
const BUTTON_SPARKLING_WATER = 3;
const BUTTON_COLD_WATER = 4;
const BUTTON_ROOM_TEMP_WATER = 1;
const BUTTON_SODA = 0;

export class CocktailMachine {
    private relay12v!: PCF8575Driver;
    private relay24v!: PCF8575Driver;
    // private ads!: ADS1115;
    relays!: RelayDriver;
    led!: PCA9685Driver;
    flowCounter!: CounterDriver;

    private stopWaterWastingAt: number = Number.MAX_SAFE_INTEGER;

    constructor(private bus: i2c.PromisifiedBus) {}

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
        this.relay24v = new PCF8575Driver(this.bus, 32);
        console.timeEnd(chalk.green("Setup GPIO expander driver 24v"));

        console.time(chalk.green("Setup GPIO expander driver 12v"));
        this.relay12v = new PCF8575Driver(this.bus, 33);
        console.timeEnd(chalk.green("Setup GPIO expander driver 12v"));
        this.relays = new RelayDriver([this.relay12v, this.relay24v]);
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

    private getButtonForState(state: State) {
        switch (state) {
            case State.COLD_WATER:
                return BUTTON_COLD_WATER;
            case State.SPARKLING_WATER:
                return BUTTON_SPARKLING_WATER;
            case State.ROOM_TEMP_WATER:
                return BUTTON_ROOM_TEMP_WATER;
            case State.SODA:
                return BUTTON_SODA;

            default:
            case State.IDLE:
                throw new Error("No button for state " + state);
        }
    }

    private async ledDriverLoop() {
        console.log(chalk.green("Led driver loop started"));

        while (true) {
            const now = new Date().getTime();
            try {
                switch (state) {
                    case State.IDLE: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            let value = Math.sin(now / 500 + i * 0.7) / 2 + 0.5;
                            await this.led.setDutyCycle(i, value);
                        }
                        break;
                    }

                    case State.SPARKLING_WATER:
                    case State.ROOM_TEMP_WATER:
                    case State.SODA:
                    case State.COLD_WATER: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            let value = Math.sin(now / 100) / 2 + 0.5;
                            if (i == this.getButtonForState(state)) {
                                await this.led.setDutyCycle(i, value);
                            } else if (this.stopWaterWastingAt === Number.MAX_SAFE_INTEGER && i == BUTTON_DISPENSE) {
                                await this.led.setDutyCycle(i, 1);
                            } else {
                                await this.led.setDutyCycle(i, 0);
                            }
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

    private async transitionState(newState: State) {
        console.log(chalk.bold(chalk.cyan(`Transition to ${State[newState]}`)));

        const now = new Date().getTime();
        try {
            switch (newState) {
                case State.IDLE: {
                    await this.relay12v.setAllGpio(0);

                    if (state === State.SPARKLING_WATER || state === State.SODA) {
                        await this.relay12v.setGpio(VALVE_WATER_MAIN, true);
                        await this.relay12v.setGpio(VALVE_ROOM_TEMP_WATER, true);
                        this.stopWaterWastingAt = now + 1500;
                    }

                    break;
                }

                case State.SODA:
                case State.SPARKLING_WATER: {
                    await this.relay12v.setGpio(VALVE_SPARKLING_WATER, true);
                    await this.relay12v.setGpio(VALVE_WATER_MAIN, true);

                    this.stopWaterWastingAt = now + 700;
                    break;
                }

                case State.COLD_WATER: {
                    await this.relay12v.setGpio(VALVE_COLD_WATER, true);
                    await this.relay12v.setGpio(VALVE_WATER_MAIN, true);

                    this.stopWaterWastingAt = now + 700;
                    break;
                }

                case State.ROOM_TEMP_WATER: {
                    await this.relay12v.setGpio(VALVE_ROOM_TEMP_WATER, true);
                    await this.relay12v.setGpio(VALVE_WATER_MAIN, true);

                    this.stopWaterWastingAt = now + 700;
                    break;
                }

                default: {
                    console.warn(chalk.red(`No transition implemented for ${State[newState]}`));
                    break;
                }
            }

            state = newState;
        } catch (ex) {
            console.error(chalk.bold(chalk.red(`Could not transition to ${State[newState]}`, ex)));
        }
    }

    private async eventLoop() {
        console.log(chalk.green("Event loop started"));

        let prevButtonStates = BUTTON_PINS.map(() => false);
        let prevLiters = 0;

        while (true) {
            const now = new Date().getTime();
            try {
                let buttonStates = BUTTON_PINS.map((e) => !digitalRead(e));
                let changedButtons = buttonStates.map((s, i) => s !== prevButtonStates[i]);
                buttonStates.forEach((e, i) => (prevButtonStates[i] = e));

                let flow = await this.flowCounter.getCounter();
                let liters = flow / FLOW_SENSOR_ROTATIONS_PER_LITER;

                if (liters !== prevLiters) {
                    console.log(chalk.gray("Liters: %d l"), liters);
                    prevLiters = liters;
                }

                switch (state) {
                    case State.IDLE: {
                        for (let i = 0; i < changedButtons.length; i++) {
                            if (changedButtons[i]) {
                                console.log(chalk.gray(`Button ${i} changed -> ${buttonStates[i]}`));
                            }
                        }

                        if (changedButtons[BUTTON_COLD_WATER] && buttonStates[BUTTON_COLD_WATER]) {
                            console.log(chalk.gray("Water button pressed, going to water state"));
                            await this.transitionState(State.COLD_WATER);
                            break;
                        }

                        if (changedButtons[BUTTON_SPARKLING_WATER] && buttonStates[BUTTON_SPARKLING_WATER]) {
                            console.log(chalk.gray("Sparkling water button pressed, going to sparkling water state"));
                            await this.transitionState(State.SPARKLING_WATER);
                            break;
                        }

                        if (changedButtons[BUTTON_ROOM_TEMP_WATER] && buttonStates[BUTTON_ROOM_TEMP_WATER]) {
                            console.log(chalk.gray("Room temp water button pressed, going to room temp water state"));
                            await this.transitionState(State.ROOM_TEMP_WATER);
                            break;
                        }

                        if (changedButtons[BUTTON_SODA] && buttonStates[BUTTON_SODA]) {
                            console.log(chalk.gray("Soda button pressed, going to soda state"));
                            await this.transitionState(State.SODA);
                            break;
                        }

                        if (now >= this.stopWaterWastingAt) {
                            console.log(chalk.gray("Stopping water wasting"));
                            this.stopWaterWastingAt = Number.MAX_SAFE_INTEGER;
                            await this.relay12v.setGpio(VALVE_ROOM_TEMP_WATER, false);
                            await this.relay12v.setGpio(VALVE_WATER_MAIN, false);
                        }

                        break;
                    }

                    case State.COLD_WATER: {
                        if (changedButtons[BUTTON_COLD_WATER] && buttonStates[BUTTON_COLD_WATER]) {
                            console.log(chalk.gray("Cold water button pressed, returning to idle"));
                            await this.transitionState(State.IDLE);
                            break;
                        }

                        if (now >= this.stopWaterWastingAt) {
                            console.log(chalk.gray("Stopping cold water wasting"));
                            this.stopWaterWastingAt = Number.MAX_SAFE_INTEGER;
                            await this.relay12v.setGpio(VALVE_COLD_WATER, false);
                        }

                        if (this.stopWaterWastingAt === Number.MAX_SAFE_INTEGER && changedButtons[BUTTON_DISPENSE]) {
                            await this.relay12v.setGpio(VALVE_COLD_WATER, buttonStates[BUTTON_DISPENSE]);
                        }

                        break;
                    }

                    case State.SPARKLING_WATER: {
                        if (changedButtons[BUTTON_SPARKLING_WATER] && buttonStates[BUTTON_SPARKLING_WATER]) {
                            console.log(chalk.gray("Sparkling water button pressed, returning to idle"));
                            await this.transitionState(State.IDLE);
                            break;
                        }

                        if (now >= this.stopWaterWastingAt) {
                            console.log(chalk.gray("Stopping sparkling water wasting"));
                            this.stopWaterWastingAt = Number.MAX_SAFE_INTEGER;
                            await this.relay12v.setGpio(VALVE_SPARKLING_WATER, false);
                        }

                        if (this.stopWaterWastingAt === Number.MAX_SAFE_INTEGER && changedButtons[BUTTON_DISPENSE]) {
                            await this.relay12v.setGpio(VALVE_SPARKLING_WATER, buttonStates[BUTTON_DISPENSE]);
                        }

                        break;
                    }

                    case State.ROOM_TEMP_WATER: {
                        if (changedButtons[BUTTON_ROOM_TEMP_WATER] && buttonStates[BUTTON_ROOM_TEMP_WATER]) {
                            console.log(chalk.gray("Sparkling water button pressed, returning to idle"));
                            await this.transitionState(State.IDLE);
                            break;
                        }

                        if (now >= this.stopWaterWastingAt) {
                            console.log(chalk.gray("Stopping room temp water wasting"));
                            this.stopWaterWastingAt = Number.MAX_SAFE_INTEGER;
                            await this.relay12v.setGpio(VALVE_ROOM_TEMP_WATER, false);
                        }

                        if (this.stopWaterWastingAt === Number.MAX_SAFE_INTEGER && changedButtons[BUTTON_DISPENSE]) {
                            await this.relay12v.setGpio(VALVE_ROOM_TEMP_WATER, buttonStates[BUTTON_DISPENSE]);
                        }

                        break;
                    }

                    case State.SODA: {
                        if (changedButtons[BUTTON_SODA] && buttonStates[BUTTON_SODA]) {
                            console.log(chalk.gray("Soda button pressed, returning to idle"));
                            await this.transitionState(State.IDLE);
                            break;
                        }

                        if (now >= this.stopWaterWastingAt) {
                            console.log(chalk.gray("Stopping sparkling water wasting"));
                            this.stopWaterWastingAt = Number.MAX_SAFE_INTEGER;
                            await this.relay12v.setGpio(VALVE_SPARKLING_WATER, false);
                        }

                        if (this.stopWaterWastingAt === Number.MAX_SAFE_INTEGER && changedButtons[BUTTON_DISPENSE]) {
                            await this.relay12v.setGpio(VALVE_SPARKLING_WATER, buttonStates[BUTTON_DISPENSE]);
                            // await this.relay.setGpio(PUMP_1, buttonStates[BUTTON_DISPENSE]);
                            await this.relay24v.setGpio(8, buttonStates[BUTTON_DISPENSE]);
                        }

                        break;
                    }

                    default: {
                        console.warn(chalk.red(`No tick implemented for ${state}`));
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
