# Rezo Plugin — Developer Setup

## Prerequisites
- macOS 12+ (Monterey or later)
- Xcode 14+ with Command Line Tools
- CMake 3.22+

## First-time Setup

```bash
cd rezo-plugin

# 1. Add JUCE as a git submodule
git submodule add https://github.com/juce-framework/JUCE.git JUCE
git submodule update --init --recursive

# 2. Configure (generates Xcode project)
cmake --preset debug-macos

# 3. Build
cmake --build build/debug --config Debug

# The built plugins are automatically copied to:
#   ~/Library/Audio/Plug-Ins/Components/Rezo.component   (AU)
#   ~/Library/Audio/Plug-Ins/VST3/Rezo.vst3              (VST3)
```

## Running Tests

```bash
cd build/debug
ctest -C Debug --output-on-failure
```

## Rescanning in Logic Pro

After building, rescan AU plugins:
```
Logic Pro → Preferences → Plug-in Manager → Reset & Rescan Selection
```

## Bluetooth Permission (first run)

On first load in Logic Pro, macOS will show a Bluetooth permission dialog.
Grant access — the entitlement in `RezoPlugin.entitlements` enables this for
the AU sandbox XPC process.

## Release Build

```bash
cmake --preset release-macos
cmake --build build/release --config Release
```

## Architecture Notes

- The audio thread NEVER touches BLE. Only `std::atomic<>` reads and FIFO writes.
- CoreBluetooth runs on its own GCD serial queue (`app.rezo.ble`).
- All JUCE UI callbacks arrive on the JUCE message thread via `MessageManager::callAsync`.
- The plugin emits MIDI clock (0xF8) at 24 PPQ downstream — place before any
  MIDI clock-consuming device in the DAW's MIDI chain.
