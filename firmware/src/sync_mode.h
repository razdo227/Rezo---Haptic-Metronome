#pragma once

#include <stdbool.h>
#include <stdint.h>

typedef enum {
  REZO_SYNC_INTERNAL = 0,
  REZO_SYNC_MIDI_CLOCK_FOLLOW = 1,
  REZO_SYNC_MIDI_BEAT_TRIGGER = 2,
} rezo_sync_mode_t;

typedef enum {
  REZO_MIDI_EVENT_CLOCK = 0,
  REZO_MIDI_EVENT_BEAT,
  REZO_MIDI_EVENT_START,
  REZO_MIDI_EVENT_STOP,
  REZO_MIDI_EVENT_CONTINUE,
  REZO_MIDI_EVENT_SPP,
} rezo_midi_event_type_t;

typedef struct {
  rezo_midi_event_type_t type;
  uint32_t at_ms;
  uint32_t spp_position;
} rezo_midi_event_t;

typedef struct {
  rezo_sync_mode_t mode;
  bool running;
  uint16_t bpm;
  uint32_t last_beat_at_ms;
  uint32_t beat_trigger_timeout_ms;
} rezo_sync_runtime_t;

void rezo_sync_init(rezo_sync_runtime_t *rt);
void rezo_sync_set_mode(rezo_sync_runtime_t *rt, rezo_sync_mode_t mode);
void rezo_sync_set_bpm(rezo_sync_runtime_t *rt, uint16_t bpm);
void rezo_sync_apply_midi_event(rezo_sync_runtime_t *rt, const rezo_midi_event_t *event);
void rezo_sync_tick(rezo_sync_runtime_t *rt, uint32_t now_ms);
bool rezo_sync_should_fire_pulse(const rezo_sync_runtime_t *rt, uint32_t now_ms);
