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

async function testI2C() {
    let bus = await i2c.openPromisified(6);
    let relay = new PCF8575Driver(bus, 32);
    let relay2 = new PCF8575Driver(bus, 33);
    let led = new PCA9685Driver(bus, 0x40);
    let ads = new ADS1115(bus, 0x48);
    let flowCounter = new CounterDriver(bus, 0x33);

    BUTTON_PINS.forEach((e) => {
        pinMode(e, PinMode.INPUT);
        pullUpDnControl(e, PullUpDownMode.UP);
    });

    await ads.initialize();

    await led.initialize();

    await relay.setAllGpio(0);
    await relay2.setAllGpio(0);

    let currentRelay = 0;
    let highlighedButton = -1;
    let button1State = false;
    let buttonStates = BUTTON_PINS.map(() => false);
    let sodaState = false;
    let prevSodaFlowState = false;
    let prevSodaFlowTimes = [];
    while (true) {
        for (let i = 0; i < 6; i++) {
            if (i < 6 && (highlighedButton === i || highlighedButton === -1)) {
                let value = Math.sin(new Date().getTime() / (highlighedButton === i ? 100 : 250) + i * 0.3) / 2 + 0.5;
                await led.setDutyCycle(i, value);
            } else {
                await led.setDutyCycle(i, 0);
            }
        }

        highlighedButton = -1;
        for (let i = 0; i < BUTTON_PINS.length; i++) {
            let state = !digitalRead(BUTTON_PINS[i]);
            if (state) {
                // console.log("button", i, chalk.green("pressed"));
                highlighedButton = i;
            }

            if (state != buttonStates[i]) {
                buttonStates[i] = state;

                if (i == 0) {
                    await relay.setGpio(RELAY_DISPOSE_TOP, state);

                    // if (button0State) {

                    //     if (currentRelay < 16) await relay.setGpio(currentRelay, false);
                    //     else await relay2.setGpio(currentRelay - 16, false);

                    //     if (++currentRelay >= 32) {
                    //         currentRelay = 0;
                    //     }

                    //     console.log("set relay", currentRelay);

                    //     if (currentRelay < 16) await relay.setGpio(currentRelay, true);
                    //     else await relay2.setGpio(currentRelay - 16, true);
                    // }
                } else if (i == 1) {
                    button1State = state;
                    if (button1State) {
                        sodaState = !sodaState;

                        await relay.setGpio(RELAY_TOP, sodaState);
                        // await relay.setGpio(RELAY_SODA0, sodaState);
                        // await relay2.setGpio(RELAY_DISPOSE_AIR - 16, sodaState);
                        await relay.setGpio(RELAY_SODA_WATER, sodaState);
                        await relay2.setGpio(RELAY_WATER - 16, sodaState);

                        console.log("soda", sodaState);
                    }
                } else if (i == 2) {
                    await relay.setGpio(RELAY_TOP, state);
                    await relay.setGpio(RELAY_DISPOSE_TOP, state);
                    await relay.setGpio(RELAY_SODA_AIR0, state);
                    await relay.setGpio(RELAY_SODA_AIR1, state);

                    // await relay2.setGpio(PERIS0_SUCK - 16, state);
                }
            }
        }

        // let buttonState = !digitalRead(15);
        // console.log("button state", buttonState ? chalk.green("yes") : chalk.red("no"));
        // highlighedButton = buttonState ? 0 : -1;

        // await relay.setGpio(0);

        let pressureVoltage = await ads.analogRead(0);
        let waterFlowVoltage = await ads.analogRead(1);
        let sodaFlowVoltage = await ads.analogRead(2);
        console.log("counter", await flowCounter.getCounter());

        let sodaFlowState = false; //sodaFlowVoltage > 2.5;
        // console.log(sodaFlowVoltage > 0.25);
        if (sodaFlowState !== prevSodaFlowState) {
            prevSodaFlowState = sodaFlowState;
            if (sodaFlowState) {
                // Rising
                prevSodaFlowTimes.push(new Date().getTime());
                while (prevSodaFlowTimes.length > 10) {
                    prevSodaFlowTimes.shift();
                }

                let sum = 0;
                for (let i = 0; i < prevSodaFlowTimes.length - 1; i++) {
                    sum += prevSodaFlowTimes[i] - prevSodaFlowTimes[i + 1];
                }
                let avg = sum / (prevSodaFlowTimes.length - 1);
                // console.log("Flow", (avg / 1000).toFixed(3), "seconds per rotation");
            }
        }

        // console.log("sodaFlowVoltage", sodaFlowVoltage.toFixed(6));
        // console.log(pressureVoltage.toFixed(4), waterFlowVoltage.toFixed(4), sodaFlowVoltage.toFixed(4));

        await new Promise((e) => setTimeout(e, 1000 / 120));
    }
}

async function main() {
    console.time(chalk.green("Setup done"));

    let bus = await i2c.openPromisified(6);
    let machine = new CocktailMachine(bus);
    await machine.initialize();
    // void ledDriverLoop(bus);
    // void eventLoop(bus);

    console.timeEnd(chalk.green("Setup done"));
}

const FRAMES_PER_SECOND = 120;

enum State {
    IDLE = 0,
    DRINKING_MODE = 1,
}

let state = State.IDLE;

// let drinkingMode = false;

const BUTTON_DRINK_MODE = 3;

class CocktailMachine {
    private stopDrinkingModeAt = Number.MAX_SAFE_INTEGER;
    private relays!: MultiPCF8575Driver;
    private ads!: ADS1115;
    private led!: PCA9685Driver;
    private flowCounter!: CounterDriver;

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
                            let value = Math.sin(now / 500 + i * 0.5) / 2 + 0.5;
                            await this.led.setDutyCycle(i, value);
                        }
                        break;
                    }

                    case State.DRINKING_MODE: {
                        for (let i = 0; i < BUTTON_PINS.length; i++) {
                            if (BUTTON_DRINK_MODE === i) {
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
                        break;
                    }

                    case State.DRINKING_MODE: {
                        if (changedButtons[BUTTON_DRINK_MODE] && buttonStates[BUTTON_DRINK_MODE]) {
                            console.log(chalk.gray("Cancel drinking mode button pressed"));
                            await this.transitionState(State.IDLE);
                            break;
                        }

                        let flowCount = await this.flowCounter.getCounter();
                        if (prevFlowCounter !== flowCount) {
                            console.log(chalk.gray("Postpone drinking mode timeout"), chalk.magenta(flowCount - prevFlowCounter));
                            // Still dispensing drinks, postpone stopping drinking mode
                            prevFlowCounter = flowCount;
                            this.stopDrinkingModeAt = now + 15000;
                        }

                        if (now >= this.stopDrinkingModeAt) {
                            console.log(chalk.gray("Drinking mode timeout reached"));
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
