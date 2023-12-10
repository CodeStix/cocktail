import i2c from "i2c-bus";

export class I2CRelayBus {
    private _cachedRelayBits: number | null = null;

    constructor(private bus: i2c.PromisifiedBus, private address: number, private inverted = true) {}

    public clearCache() {
        this._cachedRelayBits = null;
    }

    public async getAllRelays(): Promise<number> {
        if (this._cachedRelayBits === null) {
            let buffer = Buffer.alloc(2);
            await this.bus.i2cRead(this.address, buffer.length, buffer);

            let bits = (buffer[1] << 8) | buffer[0];
            if (this.inverted) {
                bits = ~bits;
            }
            this._cachedRelayBits = bits;
        }
        return this._cachedRelayBits;
    }

    public async setAllRelays(bits: number): Promise<void> {
        if (this.inverted) {
            bits = ~bits;
        }

        let buffer = Buffer.alloc(2);
        buffer[0] = bits & 0xff;
        buffer[1] = (bits >> 8) & 0xff;
        await this.bus.i2cWrite(this.address, buffer.length, buffer);
    }

    public async getRelay(pos: number): Promise<boolean> {
        return (((await this.getAllRelays()) >> pos) & 0b1) === 0b1;
    }

    public async setRelay(pos: number, enable: boolean) {
        let bits = await this.getAllRelays();

        if (enable) bits = bits | (1 << pos);
        else bits = bits & ~(1 << pos);

        await this.setAllRelays(bits);
    }
}
