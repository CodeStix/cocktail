#include <Wire.h>

void setup() {
  Wire.begin();        // join i2c bus (address optional for master)
  Serial.begin(9600);  // start serial for output

  Serial.println("begin");
}

void loop() {
  Serial.print("requesting");
  Wire.requestFrom(0x33, 4);   

  while (Wire.available() < 4) {
    Serial.print(".");
    delay(100);
  }

  Serial.print(" ");

  byte buf[4] = {0};
  for(int i = 0; i < 4; i++) {
    buf[i] = Wire.read();
  }

  uint32_t counter = buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] << 24); 

  Serial.println(counter);
 
  delay(500);
}
