import i2c from "i2c-bus";

export class PCF8575Driver {
    private _cachedGpioBits: number | null = null;

    constructor(private bus: i2c.PromisifiedBus, private address: number, private inverted = true) {}

    public clearCache() {
        this._cachedGpioBits = null;
    }

    public getGpioCount() {
        return 16;
    }

    public async getAllGpio(): Promise<number> {
        if (this._cachedGpioBits === null) {
            let buffer = Buffer.alloc(2);
            await this.bus.i2cRead(this.address, buffer.length, buffer);

            let bits = (buffer[1] << 8) | buffer[0];
            if (this.inverted) {
                bits = ~bits;
            }
            this._cachedGpioBits = bits;
        }
        return this._cachedGpioBits;
    }

    public async setAllGpio(bits: number): Promise<void> {
        this._cachedGpioBits = bits;
        if (this.inverted) {
            bits = ~bits;
        }

        let buffer = Buffer.alloc(2);
        buffer[0] = bits & 0xff;
        buffer[1] = (bits >> 8) & 0xff;
        await this.bus.i2cWrite(this.address, buffer.length, buffer);
    }

    public async getGpio(pos: number): Promise<boolean> {
        return (((await this.getAllGpio()) >> pos) & 0b1) === 0b1;
    }

    public async setGpio(pos: number, enable: boolean) {
        let bits = await this.getAllGpio();

        if (enable) bits = bits | (1 << pos);
        else bits = bits & ~(1 << pos);

        await this.setAllGpio(bits);
    }
}

export class RelayDriver {
    constructor(private drivers: PCF8575Driver[]) {}

    async clearAll() {
        for (let d of this.drivers) {
            await d.setAllGpio(0);
        }
    }

    async setGpio(num: number, value: boolean) {
        for (let d of this.drivers) {
            let dc = d.getGpioCount();
            if (num < dc) {
                await d.setGpio(num, value);
                return;
            }
            num -= dc;
        }
        throw new Error("setGpio out of range");
    }
}
