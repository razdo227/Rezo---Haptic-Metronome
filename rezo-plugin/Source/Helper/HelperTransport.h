#pragma once
#include "../BLE/IBLETransport.h"
#include <memory>

namespace Rezo
{

std::unique_ptr<IBLETransport> createHelperTransport();

} // namespace Rezo
