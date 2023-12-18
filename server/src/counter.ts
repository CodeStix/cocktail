import i2c from "i2c-bus";

export class CounterDriver {
    constructor(private bus: i2c.PromisifiedBus, private address: number) {}

    public async getCounter() {
        let buffer = Buffer.alloc(4);
        await this.bus.i2cRead(this.address, buffer.length, buffer);
        return buffer[0] | (buffer[1] << 8) | (buffer[2] << 16) | (buffer[3] << 24);
    }
}
