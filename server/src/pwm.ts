import i2c from "i2c-bus";

const REGISTER_MODE1 = 0x0;
const REGISTER_MODE2 = 0x1;
const REGISTER_LED_START = 0x6;

export class PCA9685Driver {
    constructor(private bus: i2c.PromisifiedBus, private address: number) {}

    private async readRegister(reg: number): Promise<number> {
        return await this.bus.readByte(this.address, reg);
    }

    private async writeRegister(reg: number, value: number): Promise<void> {
        await this.bus.writeByte(this.address, reg, value);
    }

    async initialize(invert = false) {
        let mode1 = await this.readRegister(REGISTER_MODE1);
        // Disable SLEEP mode to activate oscilator/pwm
        mode1 &= ~(1 << 4);
        // Enable auto increment, ability to write multiple registers at once
        mode1 |= 1 << 5;
        await this.writeRegister(REGISTER_MODE1, mode1);

        if (invert) {
            let mode2 = await this.readRegister(REGISTER_MODE2);
            // Invert outputs
            mode2 |= 1 << 4;
            await this.writeRegister(REGISTER_MODE2, mode2);
        }
    }

    private async setOnOffTime(outputIndex: number, on: number, off: number) {
        let buffer = Buffer.alloc(5);
        buffer[0] = REGISTER_LED_START + outputIndex * 4;
        buffer[1] = on & 0xff;
        buffer[2] = (on >> 8) & 0x0f;
        buffer[3] = off & 0xff;
        buffer[4] = (off >> 8) & 0x0f;
        await this.bus.i2cWrite(this.address, buffer.length, buffer);
    }

    public async setDutyCycle(outputIndex: number, percent: number) {
        await this.setOnOffTime(outputIndex, 0, Math.floor(percent * 4095));
    }
}
