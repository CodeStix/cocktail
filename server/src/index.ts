import i2c from "i2c-bus";
import { PCF8575Driver, RelayDriver as MultiPCF8575Driver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";
import { digitalRead, digitalWrite, pinMode, PinMode, pullUpDnControl, PullUpDownMode } from "tinker-gpio";
import chalk from "chalk";
import { CounterDriver } from "./counter";

const BUTTON_PINS = [15, 16, 1, 6, 10, 31];

const RELAY_SODA_WATER = 0;
const RELAY_SODA0 = 1;
const RELAY_SODA1 = 2;
const RELAY_SODA2 = 3;
const RELAY_SODA3 = 4;
const RELAY_SODA4 = 5;
const RELAY_SODA_AIR0 = 6;
const RELAY_SODA_AIR1 = 7;

const RELAY_DISPOSE_TOP = 14;
const RELAY_TOP = 15;
const RELAY_WATER = 16;
const RELAY_AIR_SODA0 = 17;
const RELAY_AIR_SODA1 = 18;
const RELAY_AIR_SODA2 = 19;
const RELAY_AIR_SODA3 = 20;
const RELAY_AIR_SODA4 = 21;
const RELAY_AIR = 22;
const RELAY_DISPOSE_AIR = 23;
const PERIS0_SUCK = 24;
const PERIS0_BLOW = 25;
const PERIS1_SUCK = 26;
const PERIS1_BLOW = 27;
const PERIS2_SUCK = 28;
const PERIS2_BLOW = 29;
const PERIS3_SUCK = 30;
const PERIS3_BLOW = 31;

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
    DRINKING_MODE = 1,
    CLEAN_MODE = 2,
}

let state = State.IDLE;

const BUTTON_DRINK_MODE = 3;
const BUTTON_CLEAN_MODE = 4;

class CocktailMachine {
    private relays!: MultiPCF8575Driver;
    private ads!: ADS1115;
    private led!: PCA9685Driver;
    private flowCounter!: CounterDriver;

    // Drinking mode state
    private stopDrinkingModeAt = Number.MAX_SAFE_INTEGER;
    private startDrinkingModeFlowCount = 0;

    // Cleaning state
    private startCleanFlowCount = 0;
    private lastFlowAt = Number.MAX_SAFE_INTEGER;
    private startFlushingWaterAt = Number.MAX_SAFE_INTEGER;
    private startFlushingAirAt = Number.MAX_SAFE_INTEGER;
    private stopFlushingAt = Number.MAX_SAFE_INTEGER;

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

                    case State.CLEAN_MODE:
                    case State.DRINKING_MODE: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            if ((state === State.DRINKING_MODE ? BUTTON_DRINK_MODE : BUTTON_CLEAN_MODE) === i) {
                                let value = Math.sin(now / 100 + i * 0.3) / 2 + 0.5;
                                await this.led.setDutyCycle(i, value);
                            } else {
                                await this.led.setDutyCycle(i, 0);
                            }
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
                    this.stopDrinkingModeAt = Number.MAX_SAFE_INTEGER;
                    await this.relays.clearAll();
                    break;
                }

                case State.DRINKING_MODE: {
                    this.stopDrinkingModeAt = now + 30000;
                    this.startDrinkingModeFlowCount = await this.flowCounter.getCounter();

                    await this.relays.clearAll();
                    await this.relays.setGpio(RELAY_TOP, true);
                    await this.relays.setGpio(RELAY_SODA_WATER, true);
                    await this.relays.setGpio(RELAY_WATER, true);
                    break;
                }

                case State.CLEAN_MODE: {
                    this.startFlushingWaterAt = now + 20000;
                    this.startFlushingAirAt = Number.MAX_SAFE_INTEGER;
                    this.stopFlushingAt = Number.MAX_SAFE_INTEGER;
                    this.startCleanFlowCount = await this.flowCounter.getCounter();
                    this.lastFlowAt = Number.MAX_SAFE_INTEGER;

                    await this.relays.clearAll();
                    await this.relays.setGpio(RELAY_TOP, true);
                    await this.relays.setGpio(RELAY_SODA_WATER, true);
                    await this.relays.setGpio(RELAY_WATER, true);
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

        let prevFlowCounter = 0;
        let prevButtonStates = BUTTON_PINS.map(() => false);

        while (true) {
            const now = new Date().getTime();
            try {
                let buttonStates = BUTTON_PINS.map((e) => !digitalRead(e));
                let changedButtons = buttonStates.map((s, i) => s !== prevButtonStates[i]);
                buttonStates.forEach((e, i) => (prevButtonStates[i] = e));

                switch (state) {
                    case State.IDLE: {
                        if (changedButtons[BUTTON_DRINK_MODE] && buttonStates[BUTTON_DRINK_MODE]) {
                            console.log(chalk.gray("Drinking mode button pressed"));
                            await this.transitionState(State.DRINKING_MODE);
                        }

                        if (changedButtons[BUTTON_CLEAN_MODE] && buttonStates[BUTTON_CLEAN_MODE]) {
                            console.log(chalk.gray("Cleaning mode button pressed"));
                            await this.transitionState(State.CLEAN_MODE);
                        }
                        break;
                    }

                    case State.DRINKING_MODE: {
                        if (changedButtons[BUTTON_DRINK_MODE] && buttonStates[BUTTON_DRINK_MODE]) {
                            console.log(chalk.gray("Cancel drinking mode button pressed"));
                            await this.transitionState(State.CLEAN_MODE);
                            break;
                        }

                        let flowCount = await this.flowCounter.getCounter();
                        if (prevFlowCounter !== flowCount) {
                            console.log(chalk.gray("Postpone drinking mode timeout"), chalk.magenta(flowCount - this.startDrinkingModeFlowCount));
                            // Still dispensing drinks, postpone stopping drinking mode
                            prevFlowCounter = flowCount;
                            this.stopDrinkingModeAt = now + 15000;
                        }

                        if (now >= this.stopDrinkingModeAt) {
                            console.log(chalk.gray("Drinking mode timeout reached"));
                            await this.transitionState(State.CLEAN_MODE);
                            break;
                        }

                        break;
                    }

                    case State.CLEAN_MODE: {
                        if (now < this.startFlushingWaterAt && this.startFlushingWaterAt !== Number.MAX_SAFE_INTEGER) {
                            let flowCount = await this.flowCounter.getCounter();

                            const MIN_NOZZLE_FLOW = 30;
                            let flowDiff = flowCount - this.startCleanFlowCount;
                            if (flowDiff > MIN_NOZZLE_FLOW) {
                                if (!(prevFlowCounter - this.startCleanFlowCount > MIN_NOZZLE_FLOW)) {
                                    console.log(chalk.gray("Nozzle was cleaned enough"));
                                }

                                // Enough flow was created to clean nozzle, wait for flow to stop
                                if (now - this.lastFlowAt > 1000) {
                                    // Start flushing water now
                                    console.log(chalk.gray("Trigger water flush early because of nozzle flow"));
                                    this.startFlushingWaterAt = now;
                                }
                            }

                            if (prevFlowCounter !== flowCount) {
                                console.log(chalk.gray("Clean flow created"), chalk.magenta(flowCount - this.startCleanFlowCount));
                                this.lastFlowAt = now;
                                prevFlowCounter = flowCount;
                            }
                        }

                        if (now >= this.startFlushingWaterAt) {
                            console.log(chalk.gray("Start flushing water"));
                            this.startFlushingAirAt = now + 3000;
                            this.startFlushingWaterAt = Number.MAX_SAFE_INTEGER;

                            await this.relays.setGpio(RELAY_DISPOSE_TOP, true);
                        }

                        if (now >= this.startFlushingAirAt) {
                            console.log(chalk.gray("Start flushing air"));
                            this.stopFlushingAt = now + 4000;
                            this.startFlushingAirAt = Number.MAX_SAFE_INTEGER;

                            await this.relays.setGpio(RELAY_WATER, false);
                            await this.relays.setGpio(RELAY_SODA_WATER, false);

                            await this.relays.setGpio(RELAY_SODA_AIR0, true);
                            await this.relays.setGpio(RELAY_SODA_AIR1, true);
                        }

                        if (now >= this.stopFlushingAt) {
                            console.log(chalk.gray("Stop flushing"));
                            this.stopFlushingAt = Number.MAX_SAFE_INTEGER;
                            await this.transitionState(State.IDLE);
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
