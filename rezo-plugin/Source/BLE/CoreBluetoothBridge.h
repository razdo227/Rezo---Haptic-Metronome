#pragma once
// This header is intentionally minimal — include it only from .mm files.
// CoreBluetooth types must not leak into C++ translation units.

#include "IBLETransport.h"
#include <memory>

namespace Rezo
{
    // Factory function — returns a CoreBluetooth-backed IBLETransport.
    // Defined in CoreBluetoothBridge.mm, called from PluginProcessor.cpp.
    std::unique_ptr<IBLETransport> createCoreBluetootTransport();
}
