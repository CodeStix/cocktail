import i2c from "i2c-bus";
import { I2CRelayBus } from "./relay";

async function testI2C() {
    let bus = await i2c.openPromisified(6);
    let relay = new I2CRelayBus(bus, 32);
    let relay2 = new I2CRelayBus(bus, 33);

    relay.setAllRelays(0);
    relay2.setAllRelays(0);

    while (true) {
        for (let i = 0; i < 16; i++) {
            console.log("set", i);
            relay.setAllRelays(1 << i);

            relay2.setAllRelays(~(1 << i));
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
