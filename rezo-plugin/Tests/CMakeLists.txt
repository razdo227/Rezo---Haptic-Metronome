include(FetchContent)
FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG        v3.5.3
)
FetchContent_MakeAvailable(Catch2)

add_executable(RezoTests
    GATTWriterTests.cpp
    HelperProtocolTests.cpp
    MidiClockGeneratorTests.cpp
)

target_link_libraries(RezoTests PRIVATE
    Catch2::Catch2WithMain
    juce::juce_core
    juce::juce_audio_processors
)

target_include_directories(RezoTests PRIVATE
    ${CMAKE_SOURCE_DIR}/Source
)

# Build the sources we want to test (without the plugin wrapper)
target_sources(RezoTests PRIVATE
    ${CMAKE_SOURCE_DIR}/Source/Protocol/GATTWriter.cpp
    ${CMAKE_SOURCE_DIR}/Source/MidiClockGenerator.cpp
)

target_compile_definitions(RezoTests PRIVATE
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
)

include(CTest)
include(Catch)
catch_discover_tests(RezoTests DISCOVERY_MODE PRE_TEST)
