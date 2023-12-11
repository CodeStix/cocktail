import i2c from "i2c-bus";

const CONVERSION_REGISTER = 0x0;
const CONFIG_REGISTER = 0x1;

export class ADS1115 {
    constructor(private bus: i2c.PromisifiedBus, private address: number) {}

    private async writeRegister(register: number, value: number) {
        let buffer = Buffer.alloc(3);
        buffer[0] = register;
        buffer[1] = (value >> 8) & 0xff;
        buffer[2] = value & 0xff;
        await this.bus.i2cWrite(this.address, buffer.length, buffer);
    }

    private async readRegister(register: number): Promise<number> {
        // Select register
        let writeBuffer = Buffer.alloc(1);
        writeBuffer[0] = register;
        await this.bus.i2cWrite(this.address, writeBuffer.length, writeBuffer);

        // Read from current register
        let readBuffer = Buffer.alloc(2);
        await this.bus.i2cRead(this.address, readBuffer.length, readBuffer);
        return (readBuffer[0] << 8) | readBuffer[1];
    }

    public async initialize() {
        let config = await this.readRegister(CONFIG_REGISTER);

        // Enable continuous mode
        config &= ~(1 << 8);
        // Set full scale
        config &= ~(0b111 << 9);
        config |= 0b000 << 9;

        await this.writeRegister(CONFIG_REGISTER, config);
    }

    public async setSelectedInput(input: number) {
        let config = await this.readRegister(CONFIG_REGISTER);

        // Clear current selection
        config &= ~(0b111 << 12);
        // Set new input (add 0b100 to disable differential mode, just compare against GND)
        config |= (0b100 | input) << 12;

        await this.writeRegister(CONFIG_REGISTER, config);
    }

    public async analogRead(input?: number) {
        if (input !== undefined) {
            await this.setSelectedInput(input);
        }

        let value = await this.readRegister(CONVERSION_REGISTER);
        if (value >= 65536 - 1) {
            // Two's complement wrap
            value = 0;
        }

        // 6.144 is the scale set during initialize, *2 because of peek to peek
        return (value / 65536) * 6.144 * 2;
    }
}
