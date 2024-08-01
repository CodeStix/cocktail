import i2c from "i2c-bus";
import { PCF8575Driver, RelayDriver as MultiPCF8575Driver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";
import { digitalRead, digitalWrite, pinMode, PinMode, pullUpDnControl, PullUpDownMode } from "tinker-gpio";
import chalk from "chalk";
import { CounterDriver } from "./counter";

const BUTTON_PINS = [15, 16, 1, 6, 10, 31];

const VALVE_WATER_MAIN = 8;
const VALVE_WATER_WASTE = 1;

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
    // SODA_WATER,
    // CLEAN,
    // DRINKING_MODE = 1,
    // CLEAN_MODE = 2,
}

let state = State.IDLE;

const BUTTON_WATER = 4;

class CocktailMachine {
    private relay!: PCF8575Driver;
    // private ads!: ADS1115;
    private led!: PCA9685Driver;
    // private flowCounter!: CounterDriver;

    private stopWaterWastingAt: number = Number.MAX_SAFE_INTEGER;

    constructor(private bus: i2c.PromisifiedBus) {}

    public async initialize() {
        console.time(chalk.green("Setup GPIO driver"));
        BUTTON_PINS.forEach((e) => {
            pinMode(e, PinMode.INPUT);
            pullUpDnControl(e, PullUpDownMode.UP);
        });
        console.timeEnd(chalk.green("Setup GPIO driver"));

        console.time(chalk.green("Setup GPIO expander driver"));
        this.relay = new PCF8575Driver(this.bus, 32);
        // let relay2 = new PCF8575Driver(this.bus, 33);
        // this.relays = new MultiPCF8575Driver([relay, relay2]);
        // await this.relays.clearAll();
        console.timeEnd(chalk.green("Setup GPIO expander driver"));

        // console.time(chalk.green("Setup ADS driver"));
        // this.ads = new ADS1115(this.bus, 0x48);
        // await this.ads.initialize();
        // console.timeEnd(chalk.green("Setup ADS driver"));

        console.time(chalk.green("Setup PWM driver"));
        this.led = new PCA9685Driver(this.bus, 0x40);
        await this.led.initialize();
        console.timeEnd(chalk.green("Setup PWM driver"));

        // console.time(chalk.green("Setup flow driver"));
        // this.flowCounter = new CounterDriver(this.bus, 0x33);
        // console.timeEnd(chalk.green("Setup flow driver"));

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

                    // case State.SODA_WATER: {
                    //     for (let i = 0; i < BUTTON_PINS.length; i++) {
                    //         let value = Math.sin(now / 500) / 2 + 0.5;
                    //         await this.led.setDutyCycle(i, [BUTTON_WATER, BUTTON_SODA_WATER].includes(i) ? value : 0);
                    //     }
                    //     break;
                    // }

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
                    await this.relay.setGpio(VALVE_WATER_MAIN, false);

                    if (state === State.WATER) {
                        await this.relay.setGpio(VALVE_WATER_WASTE, true);
                        this.stopWaterWastingAt = now + 1000;
                    } else {
                        await this.relay.setGpio(VALVE_WATER_WASTE, false);
                    }

                    // await this.relay.setAllGpio(0);
                    break;
                }

                case State.WATER: {
                    await this.relay.setGpio(VALVE_WATER_WASTE, true);
                    await this.relay.setGpio(VALVE_WATER_MAIN, true);

                    this.stopWaterWastingAt = now + 1000;
                    console.log(chalk.gray("Starting water wasting"), now, this.stopWaterWastingAt);
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
                            console.log(chalk.gray("Water button pressed, going to water state"));
                            await this.transitionState(State.WATER);
                            break;
                        }

                        if (now >= this.stopWaterWastingAt) {
                            console.log(chalk.gray("Stopping water wasting"));
                            this.stopWaterWastingAt = Number.MAX_SAFE_INTEGER;
                            await this.relay.setGpio(VALVE_WATER_WASTE, false);
                        }

                        break;
                    }

                    case State.WATER: {
                        if (changedButtons[BUTTON_WATER] && buttonStates[BUTTON_WATER]) {
                            console.log(chalk.gray("Water button pressed, returning to idle"));
                            await this.transitionState(State.IDLE);
                            break;
                        }

                        if (now >= this.stopWaterWastingAt) {
                            console.log(chalk.gray("Stopping water wasting"));
                            this.stopWaterWastingAt = Number.MAX_SAFE_INTEGER;
                            await this.relay.setGpio(VALVE_WATER_WASTE, false);
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
