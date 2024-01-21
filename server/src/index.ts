import i2c from "i2c-bus";
import { PCF8575Driver, RelayDriver as MultiPCF8575Driver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";
import { digitalRead, digitalWrite, pinMode, PinMode, pullUpDnControl, PullUpDownMode } from "tinker-gpio";
import chalk from "chalk";
import { CounterDriver } from "./counter";

const BUTTON_PINS = [15, 16, 1, 6, 10, 31];

const PERIS0 = 31;
const PERIS0_REVERSE = 30;
const PERIS1 = 29;
const PERIS1_REVERSE = 28;
const PERIS2 = 27;
const PERIS2_REVERSE = 26;
const PERIS3 = 25;
const PERIS3_REVERSE = 24;
const PERIS4 = 16;
const PERIS4_REVERSE = 17;

const VALVE_CO2 = 13;
const VALVE_CO2_RELEASE = 12;
const VALVE_SUCK_CLEAN = 11;
const VALVE_DISPOSE = 10;
const VALVE_WATER_MASTER = 9;
const MOTOR_SUCK = 8;

const VALVE_SUCK0 = 7;
const VALVE_SUCK1 = 6;
const VALVE_SUCK2 = 5;
const VALVE_SUCK3 = 4;
const VALVE_SUCK4 = 3;
const VALVE_WATER = 2;
const VALVE_SODA_RELEASE = 1;
const VALVE_SODA_WATER = 0;

async function main() {
    console.time(chalk.green("Setup done"));

    let bus = await i2c.openPromisified(6);
    let machine = new CocktailMachine(bus);
    await machine.initialize();

    console.timeEnd(chalk.green("Setup done"));
}

const FRAMES_PER_SECOND = 120;

enum State {
    IDLE = 0,
    WATER = 1,
    CLEAN = 2,
    // DRINKING_MODE = 1,
    // CLEAN_MODE = 2,
}

let state = State.IDLE;

const BUTTON_WATER = 4;
const BUTTON_CLEAN = 5;

const CLEAN_SUCK_WATER_PULSE_DURATION = 100;
const CLEAN_SUCK_WATER_PULSE_COUNT = 3;
const CLEAN_SUCK_WATER_PULSE_INTERVAL = 800;

class CocktailMachine {
    private relays!: MultiPCF8575Driver;
    private ads!: ADS1115;
    private led!: PCA9685Driver;
    private flowCounter!: CounterDriver;

    // Clean mode
    private suckWaterPulseRemainingCount = CLEAN_SUCK_WATER_PULSE_COUNT;
    private startFlushingAt = Number.MAX_SAFE_INTEGER;
    private stopFlushingAt = Number.MAX_SAFE_INTEGER;
    private startSuckingAt = Number.MAX_SAFE_INTEGER;
    private startSuckWaterAt = Number.MAX_SAFE_INTEGER;
    private stopSuckWaterAt = Number.MAX_SAFE_INTEGER;

    constructor(private bus: i2c.PromisifiedBus) {}

    public async initialize() {
        console.time(chalk.green("Setup GPIO driver"));
        BUTTON_PINS.forEach((e) => {
            pinMode(e, PinMode.INPUT);
            pullUpDnControl(e, PullUpDownMode.UP);
        });
        console.timeEnd(chalk.green("Setup GPIO driver"));

        console.time(chalk.green("Setup GPIO expander driver"));
        let relay = new PCF8575Driver(this.bus, 32);
        let relay2 = new PCF8575Driver(this.bus, 33);
        this.relays = new MultiPCF8575Driver([relay, relay2]);
        await this.relays.clearAll();
        console.timeEnd(chalk.green("Setup GPIO expander driver"));

        console.time(chalk.green("Setup ADS driver"));
        this.ads = new ADS1115(this.bus, 0x48);
        await this.ads.initialize();
        console.timeEnd(chalk.green("Setup ADS driver"));

        console.time(chalk.green("Setup PWM driver"));
        this.led = new PCA9685Driver(this.bus, 0x40);
        await this.led.initialize();
        console.timeEnd(chalk.green("Setup PWM driver"));

        console.time(chalk.green("Setup flow driver"));
        this.flowCounter = new CounterDriver(this.bus, 0x33);
        console.timeEnd(chalk.green("Setup flow driver"));

        void this.ledDriverLoop();
        void this.eventLoop();
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

                    case State.WATER: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            let value = Math.sin(now / 100) / 2 + 0.5;
                            await this.led.setDutyCycle(i, i === BUTTON_WATER ? value : 0);
                        }
                        break;
                    }

                    case State.CLEAN: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            let value = Math.sin(now / 100) / 2 + 0.5;
                            await this.led.setDutyCycle(i, i === BUTTON_CLEAN ? value : 0);
                        }
                        break;
                    }

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
                    await this.relays.clearAll();
                    break;
                }

                case State.WATER: {
                    await this.relays.clearAll();
                    await this.relays.setGpio(VALVE_WATER, true);
                    await this.relays.setGpio(VALVE_WATER_MASTER, true);
                    break;
                }

                case State.CLEAN: {
                    await this.relays.clearAll();
                    await this.relays.setGpio(VALVE_DISPOSE, true);
                    this.startFlushingAt = now + 500;
                    this.stopFlushingAt = now + 7000;
                    this.startSuckingAt = this.startFlushingAt + 1000;
                    this.startSuckWaterAt = this.startSuckingAt + 1000;
                    this.stopSuckWaterAt = Number.MAX_SAFE_INTEGER;
                    this.suckWaterPulseRemainingCount = CLEAN_SUCK_WATER_PULSE_COUNT;
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
            await this.relays.clearAll().catch((exx) => console.warn(chalk.red("Could not reset relays during transition fail"), exx));
        }
    }

    private async eventLoop() {
        console.log(chalk.green("Event loop started"));

        let prevButtonStates = BUTTON_PINS.map(() => false);
        let currentRelay = 0;

        while (true) {
            const now = new Date().getTime();
            try {
                let buttonStates = BUTTON_PINS.map((e) => !digitalRead(e));
                let changedButtons = buttonStates.map((s, i) => s !== prevButtonStates[i]);
                buttonStates.forEach((e, i) => (prevButtonStates[i] = e));

                switch (state) {
                    case State.IDLE: {
                        for (let i = 0; i < changedButtons.length; i++) {
                            if (changedButtons[i]) {
                                console.log(chalk.gray(`Button ${i} changed -> ${buttonStates[i]}`));
                            }
                        }
                        if (changedButtons[BUTTON_WATER] && buttonStates[BUTTON_WATER]) {
                            console.log(chalk.gray("Water button pressed"));
                            this.transitionState(State.WATER);
                            break;
                        }
                        if (changedButtons[BUTTON_CLEAN] && buttonStates[BUTTON_CLEAN]) {
                            console.log(chalk.gray("Clean button pressed"));
                            this.transitionState(State.CLEAN);
                            break;
                        }

                        if (changedButtons[0] && buttonStates[0]) {
                            console.log(chalk.gray(`Relay off -> ${currentRelay}`));
                            await this.relays.setGpio(currentRelay, false);
                            if (--currentRelay < 0) {
                                currentRelay = 31;
                            }
                            console.log(chalk.gray(`Relay on -> ${currentRelay}`));
                            await this.relays.setGpio(currentRelay, true);
                        }
                        if (changedButtons[1] && buttonStates[1]) {
                            console.log(chalk.gray(`Relay off -> ${currentRelay}`));
                            await this.relays.setGpio(currentRelay, false);
                            if (++currentRelay >= 32) {
                                currentRelay = 0;
                            }
                            console.log(chalk.gray(`Relay on -> ${currentRelay}`));
                            await this.relays.setGpio(currentRelay, true);
                        }

                        // if (changedButtons[BUTTON_WATER_MODE] && buttonStates[BUTTON_WATER_MODE]) {
                        //     console.log(chalk.gray("Water mode button pressed"));
                        // this.sodaIndex = 0;
                        // await this.transitionState(State.DRINKING_MODE);
                        // }

                        break;
                    }

                    case State.WATER: {
                        if (changedButtons[BUTTON_WATER] && buttonStates[BUTTON_WATER]) {
                            console.log(chalk.gray("Water button pressed"));
                            this.transitionState(State.IDLE);
                            break;
                        }
                        break;
                    }

                    case State.CLEAN: {
                        if (changedButtons[BUTTON_CLEAN] && buttonStates[BUTTON_CLEAN]) {
                            console.log(chalk.gray("Clean button pressed"));
                            this.transitionState(State.IDLE);
                            break;
                        }

                        if (now >= this.startFlushingAt) {
                            this.startFlushingAt = Number.MAX_SAFE_INTEGER;
                            console.log(chalk.gray("Start flushing"));
                            await this.relays.setGpio(VALVE_WATER, true);
                            await this.relays.setGpio(VALVE_WATER_MASTER, true);
                        }
                        if (now >= this.startSuckingAt) {
                            this.startSuckingAt = Number.MAX_SAFE_INTEGER;
                            console.log(chalk.gray("Start sucking"));
                            await this.relays.setGpio(MOTOR_SUCK, true);
                        }
                        if (now >= this.startSuckWaterAt) {
                            this.suckWaterPulseRemainingCount--;
                            this.stopSuckWaterAt = this.startSuckWaterAt + CLEAN_SUCK_WATER_PULSE_DURATION;
                            this.startSuckWaterAt = this.startSuckWaterAt + CLEAN_SUCK_WATER_PULSE_INTERVAL;
                            console.log(chalk.gray(`Start water suck pulse, ${this.suckWaterPulseRemainingCount} remaining`));
                            await this.relays.setGpio(VALVE_SUCK_CLEAN, true);
                        }
                        if (now >= this.stopSuckWaterAt) {
                            this.stopSuckWaterAt = Number.MAX_SAFE_INTEGER;
                            console.log(chalk.gray("Stop suck water pulse"));
                            await this.relays.setGpio(VALVE_SUCK_CLEAN, false);
                            if (this.suckWaterPulseRemainingCount == 0) {
                                console.log(chalk.gray("All pulses done, stop sucking"));
                                this.startSuckWaterAt = Number.MAX_SAFE_INTEGER;
                                await this.relays.setGpio(MOTOR_SUCK, false);
                                break;
                            }
                        }
                        if (now >= this.stopFlushingAt) {
                            this.stopFlushingAt = Number.MAX_SAFE_INTEGER;
                            console.log(chalk.gray("Stopping flushing, transition to idle"));
                            this.transitionState(State.IDLE);
                            break;
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

main();
