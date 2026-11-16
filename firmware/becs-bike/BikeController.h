#pragma once
#include <cstdint>

// Pure local controller. No networking, AC switching, or physical brake control.
class BikeController {
public:
  enum State { IDLE, READY, PEDALING, WARNING, PAUSED, ENDED, FAULT };
  State state = IDLE;
  bool playback = false;
  uint32_t activeMs = 0;

  void authorize(uint32_t now, uint32_t durationMs) {
    leaseUntil = now + (durationMs > 120000 ? 120000 : durationMs);
    authorized = true;
    if (state == IDLE || state == ENDED) state = READY;
  }
  void stop() { state = ENDED; playback = false; authorized = false; }
  void update(uint32_t now, float rpm, bool sensorFault = false, uint32_t stationaryForMs = 0) {
    const uint32_t elapsed = initialized ? now - lastUpdate : 0;
    initialized = true; lastUpdate = now;
    if (sensorFault || rpm < 0 || rpm > 300) { state = FAULT; playback = false; return; }
    if (state == FAULT || state == ENDED) { playback = false; return; }
    if (!authorized || static_cast<int32_t>(leaseUntil - now) <= 0) {
      state = IDLE; playback = false; stable = false; low = false; return;
    }
    if (rpm >= 50) {
      low = false;
      if (!stable) { stable = true; stableSince = now; }
      if (now - stableSince >= 3000) { state = PEDALING; playback = true; }
    } else {
      stable = false;
      // Hysteresis: 45..49 RPM maintains an established ride.
      if (rpm >= 45 && playback) { low = false; state = PEDALING; }
      else {
        if (!low) { low = true; lowSince = now; }
        const uint32_t stopped = rpm < 5 && stationaryForMs > 0 ? stationaryForMs : now - lowSince;
        if (rpm < 5 && stopped >= 10000) { state = PAUSED; playback = false; }
        else if (rpm < 5 && stopped >= 5000) state = WARNING;
        // Low pace has a separate, configurable grace window.
        else if (rpm >= 5 && stopped >= lowPaceGraceMs) { state = PAUSED; playback = false; }
      }
    }
    if (state == PEDALING && rpm >= 45 && elapsed <= 1000) activeMs += elapsed;
  }
  uint32_t lowPaceGraceMs = 15000;
private:
  uint32_t leaseUntil = 0, stableSince = 0, lowSince = 0, lastUpdate = 0;
  bool authorized = false, stable = false, low = false, initialized = false;
};
