import i2c from "i2c-bus";
import { PCF8575Driver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";
import { digitalRead, pinMode, PinMode } from "tinker-gpio";
import chalk from "chalk";

async function testI2C() {
    let bus = await i2c.openPromisified(6);
    let relay = new PCF8575Driver(bus, 32);
    let relay2 = new PCF8575Driver(bus, 33);
    let led = new PCA9685Driver(bus, 0x40);
    let ads = new ADS1115(bus, 0x48);

    pinMode(15, PinMode.INPUT);

    await ads.initialize();

    await led.initialize();

    await relay.setAllGpio(0);
    await relay2.setAllGpio(0);

    let highlighedButton = -1;
    while (true) {
        for (let i = 0; i < 6; i++) {
            if (highlighedButton === i || highlighedButton === -1) {
                let value = Math.sin(new Date().getTime() / 250 + i * 0.3) / 2 + 0.5;
                await led.setDutyCycle(i, value);
            } else {
                await led.setDutyCycle(i, 0);
            }
        }
        await new Promise((e) => setTimeout(e, 1000 / 60));

        let pressureVoltage = await ads.analogRead(0);

        let buttonState = !digitalRead(15);
        console.log("button state", buttonState ? chalk.green("yes") : chalk.red("no"));

        highlighedButton = buttonState ? 0 : -1;

        await relay.setGpio(4, buttonState);
    }
}

async function main() {
    console.log("starting up");

    await testI2C();
}

main();
