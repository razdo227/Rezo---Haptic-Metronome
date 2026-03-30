cmake_minimum_required(VERSION 3.22)
project(RezoPlugin VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "12.0" CACHE STRING "Minimum macOS version")

# JUCE — add as subdirectory (after `git submodule add`)
add_subdirectory(JUCE)

set(REZO_HELPER_INSTALL_DIR "$ENV{HOME}/Applications/Rezo Helper.app")

# ── Plugin target ──────────────────────────────────────────────────────────────
juce_add_plugin(RezoPlugin
    COMPANY_NAME                "Rezo"
    COMPANY_WEBSITE             "https://rezo.app"
    PLUGIN_MANUFACTURER_CODE    Rezo
    PLUGIN_CODE                 Rzmt
    FORMATS                     AU VST3
    PRODUCT_NAME                "Rezo"
    BUNDLE_ID                   "app.rezo.plugin"

    # MIDI effect with passthrough audio buses for VST3 host compatibility
    IS_MIDI_EFFECT              TRUE
    NEEDS_MIDI_INPUT            TRUE
    NEEDS_MIDI_OUTPUT           TRUE   # for MIDI clock output

    # AU type: kAudioUnitType_MIDIProcessor
    AU_MAIN_TYPE                "kAudioUnitType_MIDIProcessor"

    # JUCE forces non-synth VST3 plugins to include the Fx category, so keep
    # the extra tool/generator tags and satisfy hosts with a conventional bus layout.
    VST3_CATEGORIES             "Generator|Tools"

    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD     TRUE   # installs to ~/Library/Audio/Plug-Ins during dev

    # Required by macOS TCC — without this the AU XPC process is killed instantly
    # on first CBCentralManager init, even if the Bluetooth entitlement is present.
    BLUETOOTH_PERMISSION_ENABLED TRUE
    BLUETOOTH_PERMISSION_TEXT    "Rezo connects to your haptic wristband via Bluetooth to deliver real-time beat feedback."
)

# ── Sources ────────────────────────────────────────────────────────────────────
target_sources(RezoPlugin PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/PluginParameters.cpp
    Source/MidiClockGenerator.cpp
    Source/BLE/BLEManager.cpp
    Source/Helper/HelperTransport.cpp
    Source/Protocol/GATTWriter.cpp
    Source/UI/RezoLookAndFeel.cpp
    Source/UI/ConnectionPanel.cpp
    Source/UI/TransportDisplay.cpp
    Source/UI/BeatLEDs.cpp
    Source/UI/VibrationPanel.cpp
    Source/UI/RhythmPanel.cpp
    Source/UI/TimeSigPanel.cpp
)

# CoreBluetooth bridge — macOS only, compiled as Objective-C++
if(APPLE)
    target_sources(RezoPlugin PRIVATE
        Source/BLE/CoreBluetoothBridge.mm
    )
    set_source_files_properties(
        Source/BLE/CoreBluetoothBridge.mm
        PROPERTIES COMPILE_FLAGS "-fobjc-arc"
    )
    target_link_libraries(RezoPlugin PRIVATE
        "-framework CoreBluetooth"
        "-framework Foundation"
    )

    # Inject entitlements for AU sandbox (Logic Pro XPC process needs Bluetooth)
    set_target_properties(RezoPlugin_AU PROPERTIES
        XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS
            "${CMAKE_SOURCE_DIR}/RezoPlugin.entitlements"
    )
    set_target_properties(RezoPlugin_VST3 PROPERTIES
        XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS
            "${CMAKE_SOURCE_DIR}/RezoPlugin.entitlements"
    )
endif()

# ── Helper app ────────────────────────────────────────────────────────────────
if(APPLE)
    juce_add_gui_app(RezoHelper
        COMPANY_NAME                 "Rezo"
        COMPANY_WEBSITE              "https://rezo.app"
        PRODUCT_NAME                 "Rezo Helper"
        BUNDLE_ID                    "app.rezo.helper"
        COPY_PLUGIN_AFTER_BUILD      FALSE
        BLUETOOTH_PERMISSION_ENABLED TRUE
        BLUETOOTH_PERMISSION_TEXT    "Rezo Helper connects to your haptic wristband via Bluetooth for DAW plugin control."
    )

    target_sources(RezoHelper PRIVATE
        Source/Helper/RezoHelperApp.cpp
        Source/BLE/CoreBluetoothBridge.mm
    )

    set_source_files_properties(
        Source/BLE/CoreBluetoothBridge.mm
        PROPERTIES COMPILE_FLAGS "-fobjc-arc"
    )

    target_include_directories(RezoHelper PRIVATE Source)

    target_compile_definitions(RezoHelper PRIVATE
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
    )

    target_link_libraries(RezoHelper PRIVATE
        juce::juce_core
        juce::juce_events
        juce::juce_gui_basics
        juce::juce_gui_extra
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
        "-framework CoreBluetooth"
        "-framework Foundation"
    )

    add_custom_command(TARGET RezoHelper POST_BUILD
        COMMAND /bin/sh -c "/usr/libexec/PlistBuddy -c 'Set :LSUIElement true' \"$0\" || /usr/libexec/PlistBuddy -c 'Add :LSUIElement bool true' \"$0\"" "$<TARGET_BUNDLE_DIR:RezoHelper>/Contents/Info.plist"
        COMMAND "${CMAKE_COMMAND}" -E rm -rf "${REZO_HELPER_INSTALL_DIR}"
        COMMAND "${CMAKE_COMMAND}" -E copy_directory "$<TARGET_BUNDLE_DIR:RezoHelper>" "${REZO_HELPER_INSTALL_DIR}"
        COMMAND /bin/sh -c "/usr/libexec/PlistBuddy -c 'Set :LSUIElement true' \"$0\" || /usr/libexec/PlistBuddy -c 'Add :LSUIElement bool true' \"$0\"" "${REZO_HELPER_INSTALL_DIR}/Contents/Info.plist"
        COMMAND /usr/bin/codesign --force --sign - --deep --strict "${REZO_HELPER_INSTALL_DIR}"
        VERBATIM
    )
endif()

# ── Include paths ──────────────────────────────────────────────────────────────
target_include_directories(RezoPlugin PRIVATE Source)

# ── Compile definitions ────────────────────────────────────────────────────────
target_compile_definitions(RezoPlugin PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    # Uncomment during development to catch audio-thread allocations:
    # JUCE_CHECK_MEMORY_ALLOCATION_IN_AUDIO_THREAD=1
)

# ── JUCE modules ───────────────────────────────────────────────────────────────
target_link_libraries(RezoPlugin PRIVATE
    juce::juce_audio_processors
    juce::juce_audio_utils
    juce::juce_gui_basics
    juce::juce_gui_extra
    juce::juce_core
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)

# ── Tests ──────────────────────────────────────────────────────────────────────
enable_testing()
add_subdirectory(Tests)
