#include "BikeController.h"

// ESP32 reference wiring: INPUT_PULLUP GPIO27, magnetic reed/hall sensor to GND.
// One magnet/pulse per crank revolution. Do not connect to AC power or brakes.
constexpr int SENSOR_PIN = 27;
constexpr int STOP_PIN = 26;
volatile uint32_t lastPulseUs = 0;
volatile uint32_t intervalUs = 0;
BikeController controller;
String command;

void IRAM_ATTR pulse() {
  const uint32_t now = micros();
  if (now - lastPulseUs < 20000) return; // debounce
  intervalUs = now - lastPulseUs;
  lastPulseUs = now;
}
void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(STOP_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), pulse, FALLING);
}
void loop() {
  const uint32_t now = millis();
  if (digitalRead(STOP_PIN) == LOW) controller.stop();
  // Lease is supplied by the local authenticated player bridge, not an NFC tag.
  // Supported protocol: LEASE <milliseconds> / STOP / READY.
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') {
      if (command.startsWith("LEASE ")) { const long duration = command.substring(6).toInt(); if (duration > 0) controller.authorize(now, duration); }
      else if (command == "STOP") controller.stop();
      else if (command == "READY") { controller = BikeController(); }
      command = "";
    } else if (command.length() < 40) command += ch;
  }
  noInterrupts();
  const uint32_t interval = intervalUs;
  const uint32_t last = lastPulseUs;
  interrupts();
  const bool stale = micros() - last > 2000000;
  const float rpm = interval > 0 && !stale ? 60000000.0f / interval : 0;
  controller.update(now, rpm, false, stale ? (micros() - last) / 1000 : 0);
  // Local serial client must pause on playback=false, missing messages, or FAULT.
  const char* names[] = {"IDLE", "READY", "PEDALING", "WARNING", "PAUSED", "ENDED", "FAULT"};
  Serial.printf("{\"rpm\":%.1f,\"local_state\":\"%s\",\"active_seconds\":%lu,\"playback_allowed_locally\":%s}\n", rpm, names[controller.state], (unsigned long)(controller.activeMs / 1000), controller.playback ? "true" : "false");
  delay(100);
}
