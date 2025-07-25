


namespace leagueir {

    export function toHex(num: number): string {
        // Convert to 32-bit unsigned integer
        num = num >>> 0;

        let hex = "";
        const hexChars = "0123456789ABCDEF";

        // Extract each hex digit (4 bits at a time) from right to left
        for (let i = 0; i < 8; i++) {
            hex = hexChars[num & 0xF] + hex;
            num = num >>> 4;
        }


        return hex;
    }


    export let irError = "";

    /*
    */
    //% shim=leagueir::timePulse
    export function timePulse(pin: number, state: number, timeout: number): number {
        // Simulator implementation would go here
        return 0;
    }

    export const AGC_MARK = 9000; // AGC MARK = 9ms
    export const AGC_MARK_MAX = AGC_MARK + 500;
    export const AGC_MARK_MIN = AGC_MARK - 500;
    export const AGC_SPACE = 4500; // AGC SPACE = 4.5ms
    export const AGC_SPACE_MAX = AGC_SPACE + 500;
    export const AGC_SPACE_MIN = AGC_SPACE - 500;

    export const ONE_BIT = 2250; // total length of a 1 bit
    export const ZERO_BIT = 1120; // total length of a 0 bit
    export const BIT_MARK = 560; // 560us mark for all bits

    export const BIT_MARK_MAX = BIT_MARK + 75;
    export const BIT_MARK_MIN = BIT_MARK - 120;

    export const ZERO_SPACE = ZERO_BIT - BIT_MARK; // 560us space for '0'
    export const ZERO_SPACE_MAX = ZERO_SPACE + 150; // 760us max for '0'
    export const ZERO_SPACE_MIN = ZERO_SPACE - 170; // 460us min for '0'

    export const ONE_SPACE = ONE_BIT - BIT_MARK; // 1.69ms space for '1'
    export const ONE_SPACE_MAX = ONE_SPACE + 150; // 1.89ms max for '1'
    export const ONE_SPACE_MIN = ONE_SPACE - 170; // 1.64ms min for '1'
    export const STOP_BIT = 560; // Final 560us mark

    // Constants for pin states
    export const IR_HIGH = 0; // IR LED is considered "high" when the digital pin reads 0
    export const IR_LOW = 1; // IR LED is considered "low" when the digital pin reads 1







    /**
     * Read the AGC header from the IR signal
     * @param pin the digital pin to read from
     * @returns true if a valid AGC header was detected, false otherwise
     */
    export function readACGHeader(pin: DigitalPin): boolean {

        let pulseTime = 0;

        pulseTime = timePulse(pin, 1, AGC_MARK_MAX);
        if (pulseTime > 0 && pulseTime > AGC_MARK_MIN) {
            pulseTime = timePulse(pin, 0, AGC_SPACE_MAX);
            if (pulseTime > 0 && pulseTime > AGC_SPACE_MIN) {
                return true;
            }
        }

        return false;

    }

    /**
     * Read a single bit from the IR signal
     * @param pin the digital pin to read from
     * @returns 1 for a '1' bit, 0 for a '0' bit, -1 for error
     */
    export function readNecBit(pin: DigitalPin): number {

        let pulseTime = 0;

        pulseTime = timePulse(pin, 1, BIT_MARK_MAX + 200);

        if (pulseTime < 0) {
            irError = "Timeout waiting for bit mark";
            return -1;
        }

        if (pulseTime > BIT_MARK_MIN) {

            pulseTime = timePulse(pin, 0, ONE_SPACE_MAX);

            if (pulseTime < 0) {
                irError = "Timeout waiting for one space";
                return -1;
            }

            if (pulseTime > ONE_SPACE_MIN && pulseTime < ONE_SPACE_MAX) {
                return 1;
            } else if (pulseTime > ZERO_SPACE_MIN && pulseTime < ZERO_SPACE_MAX) {
                return 0;
            } else {
                irError = "Invalid space duration: " + pulseTime;
                return -1;
            }

        } else {
            irError = "Invalid mark duration: " + pulseTime;
            return -1;
        }
    }


    export function readNecCode(pin: DigitalPin): number {

        // Configure pins
        pins.setPull(pin, PinPullMode.PullUp); // Use pull-up resistor on the input pin

        while (true) {

            if (!leagueir.readACGHeader(pin)) {
                continue;
            }

            let n = 0;
            let b = 0;

            for (let i = 0; i < 32; i++) {

                b = leagueir.readNecBit(pin);
                if (b < 0) {
                    return 0;

                }

                if (b) {
                    // bit is a 1
                    n |= (1 << (31 - i));
                } else {
                    // bit is a 0
                    n &= ~(1 << (31 - i));
                }
            }

            // read the final stop bit
            let pulseTime = leagueir.timePulse(pin, 1, leagueir.STOP_BIT + 200);
            if (pulseTime < leagueir.STOP_BIT - 200 || pulseTime > leagueir.STOP_BIT + 200) {
                leagueir.irError = "Invalid stop bit duration: " + pulseTime;
                return 0;
            }

            return n;

        }
    }
    export function onNecReceived(pin: DigitalPin, handler: (address: number, command: number) => void): void {
        control.inBackground(() => {
            while (true) {
                let result = readNecCode(pin);

                let address: number;
                let command: number;

                if (result == 0) {
                    // Error occurred, return address=0 and command=error code
                    address = 0;
                    command = 0;
                } else {
                    // Split 32-bit result into high 16 bits (address) and low 16 bits (command)
                    address = (result >> 16) & 0xFFFF;
                    command = (result & 0xFFFF);
                }

                handler(address, command);

                // Small delay before next reading
                basic.pause(10);
            }
        });
    }


    /* Function used for simulator, actual implementation is in pulse.cpp
     * @param pin the digital pin number
     * @param command the 32-bit command to send
     */
    //% shim=leagueir::sendCommand
    export function sendCommandCpp(pin: number, command: number): void {
        // Simulator implementation would go here
    }


    export function sendCommand(pin: DigitalPin, address: number, command: number): void {
        
        // Combine address (upper 16 bits) and command (lower 16 bits) into 32-bit value
        let combined = ((address & 0xFFFF) << 16) | (command & 0xFFFF);
        leagueir.sendCommandCpp(pin, combined);
    }

}