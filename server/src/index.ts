import i2c from "i2c-bus";
import { PCF8575Driver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";
import { digitalRead, digitalWrite, pinMode, PinMode, pullUpDnControl, PullUpDownMode } from "tinker-gpio";
import chalk from "chalk";

const BUTTON_PINS = [15, 16, 1, 6, 10, 31];

async function testI2C() {
    let bus = await i2c.openPromisified(6);
    let relay = new PCF8575Driver(bus, 32);
    let relay2 = new PCF8575Driver(bus, 33);
    let led = new PCA9685Driver(bus, 0x40);
    let ads = new ADS1115(bus, 0x48);

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
    let buttonState = false;
    while (true) {
        for (let i = 0; i < 6; i++) {
            if (highlighedButton === i || highlighedButton === -1) {
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
                console.log("button", i, chalk.green("pressed"));
                highlighedButton = i;
            }

            if (i == 0 && state !== buttonState) {
                buttonState = state;
                if (buttonState) {
                    if (currentRelay < 16) await relay.setGpio(currentRelay, false);
                    else await relay2.setGpio(currentRelay - 16, false);

                    console.log("next relay");
                    if (++currentRelay > 32) {
                        currentRelay = 0;
                    }

                    if (currentRelay < 16) await relay.setGpio(currentRelay, true);
                    else await relay2.setGpio(currentRelay - 16, true);
                }
            }
        }

        // let buttonState = !digitalRead(15);
        // console.log("button state", buttonState ? chalk.green("yes") : chalk.red("no"));
        // highlighedButton = buttonState ? 0 : -1;

        // await relay.setGpio(0);

        let pressureVoltage = await ads.analogRead(0);

        await new Promise((e) => setTimeout(e, 1000 / 120));
    }
}

async function main() {
    console.log("starting up");

    await testI2C();
}

main();
