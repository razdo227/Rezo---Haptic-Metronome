import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { DeviceProvider, useDevice } from './src/context/DeviceContext';
import PairingScreen from './src/screens/PairingScreen';
import MainScreen from './src/screens/MainScreen';

function AppNavigator() {
  const { state } = useDevice();
  const isConnected = state.connectionState === 'connected';

  return (
    <>
      <StatusBar style="light" backgroundColor="#0A0A0F" />
      {isConnected ? <MainScreen /> : <PairingScreen />}
    </>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <AppNavigator />
    </DeviceProvider>
  );
}
