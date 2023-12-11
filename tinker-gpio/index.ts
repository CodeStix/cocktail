const bindings = require("bindings")("native");

export enum PinMode {
    INPUT = 0,
    OUTPUT = 1,
}

export function digitalWrite(pin: number, value: boolean): void {
    bindings.digitalWrite(pin, value);
}

export function digitalRead(pin: number): boolean {
    return bindings.digitalRead(pin);
}

export function pinMode(pin: number, mode: PinMode): void {
    bindings.pinMode(pin, mode);
}
