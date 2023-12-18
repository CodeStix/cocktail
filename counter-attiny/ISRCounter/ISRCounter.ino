// https://thewanderingengineer.com/2014/02/17/attiny-i2c-slave/
// https://github.com/nadavmatalon/TinyWireS/tree/master
// https://www.instructables.com/ATtiny85-Interrupt-Barebones-Example/

// SDA = 0, SCL = 2 and interrupt pin = 1 on attiny85

#include <TinyWireS.h>

#define INTERRUPT_PIN PCINT1  // This is PB1 per the schematic
#define INT_PIN PB1           // Interrupt pin of choice: PB1 (same as PCINT1) - Pin 6
#define PCINT_VECTOR PCINT0_vect      // This step is not necessary - it's a naming thing for clarit

volatile uint32_t counter = 0;

void receiveEvent()
{
  TinyWireS.write(counter & 0xFF);
  TinyWireS.write((counter >> 8) & 0xFF);
  TinyWireS.write((counter >> 16) & 0xFF);
  TinyWireS.write((counter >> 24) & 0xFF);
}

void setup() {
  cli();                            // Disable interrupts during setup
  PCMSK |= (1 << INTERRUPT_PIN);    // Enable interrupt handler (ISR) for our chosen interrupt pin (PCINT1/PB1/pin 6)
  GIMSK |= (1 << PCIE);             // Enable PCINT interrupt in the general interrupt mask
  pinMode(INT_PIN, INPUT_PULLUP);   // Set our interrupt pin as input with a pullup to keep it stable
  sei();                            // Last line of setup - enable interrupts after setup

  //  Serial.begin(115200);
  //  pinMode(LED_BUILTIN, OUTPUT);
  //  pinMode(2, INPUT);
  TinyWireS.begin(0x33);
  TinyWireS.onRequest(receiveEvent); // register event
}


void loop() {
  //  Serial.print(counterPerMillis);
  //  Serial.println();
  TinyWireS_stop_check();
}

ISR(PCINT_VECTOR)
{
  counter++;
}
