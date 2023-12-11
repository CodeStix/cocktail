import i2c from "i2c-bus";
import { PCF8575Driver } from "./gpio";
import { PCA9685Driver } from "./pwm";
import { ADS1115 } from "./ads";

async function testI2C() {
    let bus = await i2c.openPromisified(6);
    let relay = new PCF8575Driver(bus, 32);
    let relay2 = new PCF8575Driver(bus, 33);
    let led = new PCA9685Driver(bus, 0x40);
    let ads = new ADS1115(bus, 0x48);

    await ads.initialize();

    await led.initialize();

    await relay.setAllGpio(0);
    await relay2.setAllGpio(0);

    while (true) {
        // for (let i = 0; i < 16; i++) {
        // console.log("set", i / 16);
        // relay.setAllGpio(1 << i);

        // relay2.setAllGpio(~(1 << i));
        // }
        // console.log("value", value);
        for (let i = 0; i < 6; i++) {
            let value = Math.sin(new Date().getTime() / 100 + i * 0.3) / 2 + 0.5;
            await led.setDutyCycle(i, value);
        }
        await new Promise((e) => setTimeout(e, 1000 / 60));

        let pressureVoltage = await ads.analogRead(0);
        console.log("pressure", (pressureVoltage / 4.5) * 5 + 1);
    }
    // await bus.writeByte(32, 0b00001111, 0b00111100);
    // await bus.writeByte(33, 0b00001111, 0b00111100);
    // let addresses = await bus.scan(0x03, 0x77);
    // console.log("addresses", addresses);
}

async function main() {
    console.log("starting up");

    await testI2C();
}

main();
