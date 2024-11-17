import i2c from "i2c-bus";
import { EventEmitter } from "events";

export class PCF8575Driver extends EventEmitter {
    private _cachedGpioBits: number | null = null;

    constructor(private bus: i2c.PromisifiedBus, private address: number, private inverted = true) {
        super();
    }

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

        // super.emit("get", this._cachedGpioBits);

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

        super.emit("set", this.inverted ? ~bits : bits);
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

export class RelayDriver extends EventEmitter {
    constructor(private drivers: PCF8575Driver[]) {
        super();

        for (let driver of this.drivers) {
            driver.on("set", async () => {
                this.emit("set", await this.getAllGpio());
            });
        }
    }

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

    async getGpio(num: number): Promise<boolean> {
        for (let d of this.drivers) {
            let dc = d.getGpioCount();
            if (num < dc) {
                return await d.getGpio(num);
            }
            num -= dc;
        }
        throw new Error("getGpio out of range");
    }

    async getAllGpio(): Promise<boolean[]> {
        let values = [] as boolean[];
        for (let driver of this.drivers) {
            let dc = driver.getGpioCount();
            let num = await driver.getAllGpio();
            for (let di = 0; di < dc; di++) {
                values.push(((num >>> di) & 0x1) === 0x1);
            }
        }
        return values;
    }

    async setAllGpio(values: boolean[]): Promise<void> {
        let i = 0;
        for (let driver of this.drivers) {
            let dc = driver.getGpioCount();
            let num = 0;
            for (let di = 0; di < dc; di++) {
                if (values[i++]) num |= 1 << di;
            }

            await driver.setAllGpio(num);
        }
    }

    async clearAllGpio(): Promise<void> {
        for (let driver of this.drivers) {
            await driver.setAllGpio(0);
        }
    }
}
