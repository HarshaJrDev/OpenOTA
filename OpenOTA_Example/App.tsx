/**
 * OpenOTA Example — a real, minimal OTA client for the OpenOTA platform.
 *
 * One screen, on purpose: everything it shows (version, update status, progress) comes straight
 * from the live api.openota.xyz server via the real @openota/sdk + @openota/native-android
 * packages. Release/channel/device management happens on the OpenOTA Dashboard, never here.
 *
 * @format
 */

import React from "react";
import { StatusBar, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OtaProvider } from "./src/context/OtaContext";
import { HomeScreen } from "./src/screens/HomeScreen";

function App() {
  const isDarkMode = useColorScheme() === "dark";

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <OtaProvider>
        <HomeScreen />
      </OtaProvider>
    </SafeAreaProvider>
  );
}

export default App;
