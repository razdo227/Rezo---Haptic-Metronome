#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <time.h>

#include "sync_mode.h"

static uint32_t uptime_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (uint32_t)(ts.tv_sec * 1000u + ts.tv_nsec / 1000000u);
}

int main(void) {
  rezo_sync_runtime_t sync;
  rezo_sync_init(&sync);

  // Boot defaults
  rezo_sync_set_mode(&sync, REZO_SYNC_INTERNAL);
  rezo_sync_set_bpm(&sync, 120);

  printf("Rezo firmware scaffold started. mode=%d bpm=%u\n", (int)sync.mode, sync.bpm);

  uint32_t last_tick = uptime_ms();

  while (true) {
    uint32_t now = uptime_ms();

    // 1) Periodic runtime maintenance
    if ((now - last_tick) >= 10u) {
      rezo_sync_tick(&sync, now);
      last_tick = now;
    }

    // 2) Transport scheduler placeholder
    if (rezo_sync_should_fire_pulse(&sync, now)) {
      // TODO: trigger haptic pulse via DRV2605L render pipeline
      // TODO: emit status notify over BLE
    }

    // TODO: poll BLE command queue and call:
    // - rezo_sync_set_mode(...)
    // - rezo_sync_set_bpm(...)
    // - rezo_sync_apply_midi_event(...)
  }

  return 0;
}
