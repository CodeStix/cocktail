import i2c from "i2c-bus";
import { PCF8575Driver } from "./relay";

async function testI2C() {
    let bus = await i2c.openPromisified(6);
    let relay = new PCF8575Driver(bus, 32);
    let relay2 = new PCF8575Driver(bus, 33);

    relay.setAllGpio(0);
    relay2.setAllGpio(0);

    while (true) {
        for (let i = 0; i < 16; i++) {
            console.log("set", i);
            relay.setAllGpio(1 << i);

            relay2.setAllGpio(~(1 << i));
            await new Promise((e) => setTimeout(e, 500));
        }
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
