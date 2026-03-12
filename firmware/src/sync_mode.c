#include "sync_mode.h"

static uint16_t clamp_bpm(uint16_t bpm) {
  if (bpm < 20) return 20;
  if (bpm > 300) return 300;
  return bpm;
}

void rezo_sync_init(rezo_sync_runtime_t *rt) {
  rt->mode = REZO_SYNC_INTERNAL;
  rt->running = false;
  rt->bpm = 120;
  rt->last_beat_at_ms = 0;
  rt->beat_trigger_timeout_ms = 2000;
}

void rezo_sync_set_mode(rezo_sync_runtime_t *rt, rezo_sync_mode_t mode) {
  rt->mode = mode;
}

void rezo_sync_set_bpm(rezo_sync_runtime_t *rt, uint16_t bpm) {
  rt->bpm = clamp_bpm(bpm);
}

void rezo_sync_apply_midi_event(rezo_sync_runtime_t *rt, const rezo_midi_event_t *event) {
  switch (event->type) {
    case REZO_MIDI_EVENT_START:
    case REZO_MIDI_EVENT_CONTINUE:
      rt->running = true;
      break;
    case REZO_MIDI_EVENT_STOP:
      rt->running = false;
      break;
    case REZO_MIDI_EVENT_BEAT:
      if (rt->mode == REZO_SYNC_MIDI_BEAT_TRIGGER) {
        rt->last_beat_at_ms = event->at_ms;
        rt->running = true;
      }
      break;
    case REZO_MIDI_EVENT_CLOCK:
    case REZO_MIDI_EVENT_SPP:
    default:
      break;
  }
}

void rezo_sync_tick(rezo_sync_runtime_t *rt, uint32_t now_ms) {
  if (rt->mode != REZO_SYNC_MIDI_BEAT_TRIGGER) return;
  if (!rt->running) return;
  if (rt->last_beat_at_ms == 0) return;

  if ((now_ms - rt->last_beat_at_ms) > rt->beat_trigger_timeout_ms) {
    rt->running = false;
  }
}

bool rezo_sync_should_fire_pulse(const rezo_sync_runtime_t *rt, uint32_t now_ms) {
  if (!rt->running) return false;

  if (rt->mode == REZO_SYNC_MIDI_BEAT_TRIGGER) {
    // Pulse fire should be edge-driven by incoming beat event.
    // This function is placeholder until event queue integration.
    (void)now_ms;
    return false;
  }

  // INTERNAL / MIDI_CLOCK_FOLLOW scheduler pulse generation is implemented
  // in the transport scheduler layer (next step).
  (void)now_ms;
  return false;
}
