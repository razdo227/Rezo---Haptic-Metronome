#pragma once

#include <stdint.h>

// Placeholder UUID plan (replace with final 128-bit UUIDs)
// Service: REZO Control
// Characteristics:
//  - Command RX (write)
//  - Status TX (notify)

typedef enum {
  REZO_CMD_SET_TEMPO = 0x01,
  REZO_CMD_SET_SYNC_MODE = 0x02,
  REZO_CMD_SET_TRANSPORT = 0x03,
  REZO_CMD_SET_VIBRATION = 0x04,
} rezo_cmd_type_t;

typedef enum {
  REZO_TRANSPORT_STOP = 0,
  REZO_TRANSPORT_START = 1,
} rezo_transport_cmd_t;

typedef enum {
  REZO_VIB_SOFT = 0,
  REZO_VIB_PULSE = 1,
  REZO_VIB_SHARP = 2,
} rezo_vibration_type_t;

typedef struct {
  uint8_t type;
  uint8_t payload[16];
  uint8_t payload_len;
} rezo_ble_command_t;
