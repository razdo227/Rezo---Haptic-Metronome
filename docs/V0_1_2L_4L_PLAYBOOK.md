# Rezo v0.1 — 2/4 Layer Playbook (XIAO module + back-side assembly)

## Scope lock (per Avadhoot)
- Keep existing v0.1 component set as-is.
- XIAO nRF52840 module is hand-soldered onto host PCB.
- Back side contains remaining components and is JLCPCB-assembled.
- Goal: robust first-pass manufacturable board, not max miniaturization.

## Layer decision
- **Preferred for v0.1:** 4-layer (more robust power/GND return, lower BLE/motor noise coupling).
- **Fallback:** 2-layer if cost/speed pressure is high.

### Recommended stack
## 4-layer
- L1: top signals + XIAO pads
- L2: solid GND plane
- L3: power distribution + secondary routing
- L4: bottom components/routing (JLC assembly side)

## 2-layer
- L1: XIAO pads + critical short routes
- L2: components + most routing
- Use aggressive GND pours on both layers, stitched vias.

## Placement strategy
1. Lock XIAO location first (edge clearance + antenna keepout).
2. Keep copper/components out of XIAO antenna region under/around module antenna section.
3. Place DRV2605L parts close to LRA connectors.
4. Keep motor current loops compact and away from RF area.
5. Put battery entry + decoupling close to power ingress.
6. Keep I2C pullups close to bus center/master side.

## JLC-oriented DRC baseline (safe defaults)
Use these conservative values in KiCad board setup:
- Min track width: **0.15 mm**
- Min clearance: **0.15 mm**
- Via drill: **0.30 mm**
- Via diameter: **0.60 mm**
- Microvias: **off** for v0.1
- Solder mask expansion: default KiCad/JLC standard
- Copper to board edge: **>= 0.25 mm** (prefer 0.3 mm)

For power/motor paths, use wider traces (0.4–0.8 mm where practical).

## ERC/DRC pass criteria
Release candidate only if:
- ERC: 0 errors (warnings reviewed explicitly)
- DRC: 0 errors
- Unconnected items: 0
- Silkscreen clipped: 0
- Courtyard conflicts: 0

## Assembly-readiness checklist (JLC)
- All SMD parts to be assembled are on **one assembly side** (bottom per your plan).
- Through-hole or hand-solder-only parts marked as DNP/hand assembly as needed.
- Footprint rotations verified in 3D and position files.
- BOM MPNs fixed and available (or approved alternates).
- CPL generated and spot-checked against PCB orientation.
- Fiducials present if needed for dense placement.

## XIAO hand-solder guidance
- Keep pad geometry friendly (do not undersize castellated landing pads).
- Leave tool access around module perimeter for iron/hot air.
- Avoid tall components too close to XIAO edges.
- Add at least one mechanical alignment reference mark on silkscreen.

## Output package for fab
- Gerbers (RS-274X)
- Drill files
- BOM (CSV)
- CPL/Pick-and-place (CSV)
- Assembly drawing (PDF)
- README with hand-solder steps for XIAO + connectors

## v0.1 sign-off gate
Before ordering:
1. KiCad ERC/DRC clean
2. Antenna keepout verified
3. Motor lines + power integrity reviewed
4. JLC BOM/CPL sanity checked
5. Manual assembly points documented
