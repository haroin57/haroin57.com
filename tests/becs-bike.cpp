#include "../firmware/becs-bike/BikeController.h"
#include <cassert>
int main() {
  BikeController bike;
  bike.update(0, 60); assert(!bike.playback);
  bike.authorize(0, 120000);
  for (unsigned t = 0; t <= 4000; t += 100) bike.update(t, 55);
  assert(bike.state == BikeController::PEDALING && bike.playback);
  bike.update(5000, 46); assert(bike.playback);
  for (unsigned t = 5100; t <= 10100; t += 100) bike.update(t, 0);
  assert(bike.state == BikeController::WARNING && bike.playback);
  for (unsigned t = 10200; t <= 15100; t += 100) bike.update(t, 0);
  assert(bike.state == BikeController::PAUSED && !bike.playback);
  bike.update(120001, 60); assert(!bike.playback);
  bike.authorize(120001, 120000); bike.update(120002, 60, true);
  assert(bike.state == BikeController::FAULT && !bike.playback);
  bike.stop(); assert(!bike.playback && bike.state == BikeController::ENDED);
  BikeController low; low.authorize(0, 120000);
  for (unsigned t = 0; t <= 4000; t += 100) low.update(t, 55);
  for (unsigned t = 4100; t <= 14100; t += 100) low.update(t, 20);
  assert(low.playback); // separate grace from abrupt-stop timeout
  low.update(19100, 20); assert(!low.playback);
}
