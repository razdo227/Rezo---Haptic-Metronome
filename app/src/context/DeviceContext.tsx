import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { DeviceState, DeviceAction, SyncMode, FoundDevice, PatternId } from '../types';
import bleService from '../services/BLEService';
import { BPM_DEFAULT, normalizePatternId } from '../constants/ble';

const initialState: DeviceState = {
  connectionState: 'disconnected',
  deviceId: null,
  isPlaying: false,
  bpm: BPM_DEFAULT,
  syncMode: 'INTERNAL',
  activePattern: 'PULSE',
  currentBeat: 0,
  timeSignatureNumerator: 4,
  foundDevices: [],
  batteryPercent: null,
};

function parseStatus(raw: string): {
  status: Partial<Pick<DeviceState, 'isPlaying' | 'bpm' | 'syncMode' | 'activePattern'>>;
  batteryPercent?: number;
} {
  const status: Partial<Pick<DeviceState, 'isPlaying' | 'bpm' | 'syncMode' | 'activePattern'>> = {};
  let batteryPercent: number | undefined;
  const pairs = raw.split(';');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (!key || value === undefined) continue;
    const k = key.trim();
    const v = value.trim();
    switch (k) {
      case 'run':
        status.isPlaying = v === '1';
        break;
      case 'bpm': {
        const parsed = parseInt(v, 10);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 300) {
          status.bpm = parsed;
        }
        break;
      }
      case 'mode':
        if (v === 'INTERNAL' || v === 'MIDI_CLOCK' || v === 'MIDI_BEAT') {
          status.syncMode = v as SyncMode;
        }
        break;
      case 'pattern':
        status.activePattern = normalizePatternId(v);
        break;
      case 'bat': {
        const parsed = parseInt(v, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          batteryPercent = parsed;
        }
        break;
      }
    }
  }
  return { status, batteryPercent };
}

function reducer(state: DeviceState, action: DeviceAction): DeviceState {
  switch (action.type) {
    case 'SET_CONNECTION':
      return {
        ...state,
        connectionState: action.payload.connectionState,
        deviceId: action.payload.deviceId !== undefined ? action.payload.deviceId : state.deviceId,
        // Reset beat simulation when disconnected
        currentBeat: action.payload.connectionState === 'disconnected' ? 0 : state.currentBeat,
        isPlaying: action.payload.connectionState === 'disconnected' ? false : state.isPlaying,
      };
    case 'UPDATE_FROM_STATUS':
      return {
        ...state,
        ...action.payload,
      };
    case 'SET_BPM_OPTIMISTIC':
      return { ...state, bpm: action.payload };
    case 'SET_PATTERN_OPTIMISTIC':
      return { ...state, activePattern: action.payload };
    case 'SET_PLAYING_OPTIMISTIC':
      return {
        ...state,
        isPlaying: action.payload,
        currentBeat: action.payload ? 0 : state.currentBeat,
      };
    case 'SET_BEAT':
      return { ...state, currentBeat: action.payload };
    case 'SET_TIME_SIG':
      return { ...state, timeSignatureNumerator: action.payload, currentBeat: 0 };
    case 'ADD_FOUND_DEVICE': {
      const exists = state.foundDevices.some((d) => d.id === action.payload.id);
      if (exists) {
        // Update rssi if already in list
        return {
          ...state,
          foundDevices: state.foundDevices.map((d) =>
            d.id === action.payload.id ? action.payload : d
          ),
        };
      }
      return { ...state, foundDevices: [...state.foundDevices, action.payload] };
    }
    case 'CLEAR_FOUND_DEVICES':
      return { ...state, foundDevices: [] };
    case 'SET_BATTERY':
      return { ...state, batteryPercent: action.payload };
    default:
      return state;
  }
}

interface DeviceContextValue {
  state: DeviceState;
  sendCommand: (cmd: string) => Promise<void>;
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectToDevice: (deviceId: string) => void;
  disconnect: () => void;
  setTimeSignature: (numerator: number) => void;
  setPlayingOptimistic: (playing: boolean) => void;
  setBPMOptimistic: (bpm: number) => void;
  setPatternOptimistic: (pattern: PatternId) => void;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const beatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Wire BLE service callbacks
  useEffect(() => {
    bleService.onConnectionChange = (connectionState, deviceId) => {
      dispatch({ type: 'SET_CONNECTION', payload: { connectionState, deviceId } });
    };

    bleService.onStatusUpdate = (raw: string) => {
      const { status, batteryPercent } = parseStatus(raw);
      dispatch({ type: 'UPDATE_FROM_STATUS', payload: status });
      if (batteryPercent !== undefined) {
        dispatch({ type: 'SET_BATTERY', payload: batteryPercent });
      }
    };

    bleService.onDeviceFound = (device: FoundDevice) => {
      dispatch({ type: 'ADD_FOUND_DEVICE', payload: device });
    };

    return () => {
      bleService.onConnectionChange = null;
      bleService.onStatusUpdate = null;
      bleService.onDeviceFound = null;
    };
  }, []);

  // Beat simulation
  useEffect(() => {
    if (beatIntervalRef.current) {
      clearInterval(beatIntervalRef.current);
      beatIntervalRef.current = null;
    }

    if (state.isPlaying && state.connectionState === 'connected') {
      const intervalMs = Math.round(60000 / state.bpm);
      beatIntervalRef.current = setInterval(() => {
        const current = stateRef.current;
        const nextBeat = (current.currentBeat + 1) % current.timeSignatureNumerator;
        dispatch({ type: 'SET_BEAT', payload: nextBeat });
      }, intervalMs);
    }

    return () => {
      if (beatIntervalRef.current) {
        clearInterval(beatIntervalRef.current);
        beatIntervalRef.current = null;
      }
    };
  }, [state.isPlaying, state.bpm, state.connectionState]);

  const sendCommand = useCallback(async (cmd: string): Promise<void> => {
    await bleService.sendCommand(cmd);
  }, []);

  const startScan = useCallback(async (): Promise<void> => {
    dispatch({ type: 'CLEAR_FOUND_DEVICES' });
    await bleService.startScan();
  }, []);

  const stopScan = useCallback((): void => {
    bleService.stopScan();
  }, []);

  const connectToDevice = useCallback((deviceId: string): void => {
    dispatch({ type: 'CLEAR_FOUND_DEVICES' });
    bleService.connect(deviceId);
  }, []);

  const disconnect = useCallback((): void => {
    bleService.disconnect();
  }, []);

  const setTimeSignature = useCallback((numerator: number): void => {
    dispatch({ type: 'SET_TIME_SIG', payload: numerator });
  }, []);

  const setPlayingOptimistic = useCallback((playing: boolean): void => {
    dispatch({ type: 'SET_PLAYING_OPTIMISTIC', payload: playing });
  }, []);

  const setBPMOptimistic = useCallback((bpm: number): void => {
    dispatch({ type: 'SET_BPM_OPTIMISTIC', payload: bpm });
  }, []);

  const setPatternOptimistic = useCallback((pattern: PatternId): void => {
    dispatch({ type: 'SET_PATTERN_OPTIMISTIC', payload: pattern });
  }, []);

  return (
    <DeviceContext.Provider value={{
      state,
      sendCommand,
      startScan,
      stopScan,
      connectToDevice,
      disconnect,
      setTimeSignature,
      setPlayingOptimistic,
      setBPMOptimistic,
      setPatternOptimistic,
    }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceContextValue {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
}

export function useDeviceDispatch() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDeviceDispatch must be used within DeviceProvider');
  return ctx;
}

export { parseStatus };
export type { DeviceContextValue };
