# KiCad Next Steps — Rezo v0.1 -> v0.2

## Current snapshot (from project files)
- Uses **XIAO nRF52840 SMD module** as MCU core
- Two haptic drivers: **DRV2605L** (left/right)
- Two LRA connectors: `LRA_L`, `LRA_R`
- Battery input connector present
- Basic passives and push button present

## Immediate cleanup (today)
1. Remove stale lock files before editing:
   - `~rezo_v0.1.kicad_sch.lck`
   - `~rezo_v0.1.kicad_pcb.lck`
2. Run ERC and fix all power/input warnings before layout changes.
3. Freeze naming:
   - rails: `VBAT`, `3V3`, `GND`
   - buses: `I2C_SCL`, `I2C_SDA`
   - haptic lines: `LRA_L+/-`, `LRA_R+/-`

## Schematic hardening checklist
- [ ] Add battery protection/fuse strategy (polyfuse or equivalent)
- [ ] Confirm charge path and power OR-ing behavior (USB + battery)
- [ ] Confirm DRV2605L address strategy (left/right on same I2C bus)
- [ ] Add proper decoupling close to each DRV2605L (0.1u + 1u local)
- [ ] Add test points: VBAT, 3V3, GND, SDA, SCL, nRESET
- [ ] Add programming/debug access pads (SWDIO, SWCLK, GND, 3V3)
- [ ] Add ESD/TVS on external exposed contacts where appropriate

## PCB plan (6-layer target)
Proposed stack:
- L1: components + critical signals
- L2: solid GND
- L3: power + medium-speed routing
- L4: medium-speed routing + local pours
- L5: solid GND
- L6: low-speed + connectors

Rules:
- Keep unbroken GND under XIAO RF/antenna region; obey XIAO keepout
- Keep motor return currents away from RF/module zone
- Place DRV2605L close to LRA connectors
- Keep I2C short and clean; pull-ups near bus master/center
- Separate noisy power paths from BLE-sensitive region

## Placement order
1. Lock XIAO module position + antenna keepout edge clearance
2. Place battery + charging/protection path
3. Place DRV2605L pair + nearby passives
4. Place LRA connectors near strap exit geometry
5. Place button and user I/O
6. Finalize test pads and board-edge contacts

## DFM prep for JLCPCB
- [ ] Confirm all footprints exist in local/project libs
- [ ] Set fab notes (stackup, impedance if needed, copper weight)
- [ ] Run DRC with JLC min clearances
- [ ] Generate and verify: Gerber, drill, pick-place, BOM
- [ ] 3D check for strap enclosure interference

## Gate to release v0.2
Only release for fab when all are true:
- ERC = 0 errors
- DRC = 0 errors (only documented waivers)
- Test points present
- SWD access present
- Power tree reviewed
- Antenna keepout respected
