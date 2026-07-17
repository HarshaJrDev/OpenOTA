/**
 * OpenOTA Developer Playground
 * @format
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { TabStrip } from './src/navigation/TabStrip';
import type { PlaygroundSection } from './src/navigation/sections';
import { AboutScreen } from './src/screens/AboutScreen';
import { BundleExplorerScreen } from './src/screens/BundleExplorerScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { DevToolsScreen } from './src/screens/DevToolsScreen';
import { LogsScreen } from './src/screens/LogsScreen';
import { RuntimeInspectorScreen } from './src/screens/RuntimeInspectorScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { UpdatesScreen } from './src/screens/UpdatesScreen';
import { initOtaPlayground } from './src/services/otaPlayground.service';
import { usePlaygroundStore } from './src/store/playgroundStore';
import { playgroundDarkTheme, playgroundLightTheme } from './src/theme/theme';

function renderSection(section: PlaygroundSection): React.JSX.Element {
  switch (section) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'updates':
      return <UpdatesScreen />;
    case 'runtime':
      return <RuntimeInspectorScreen />;
    case 'bundle':
      return <BundleExplorerScreen />;
    case 'logs':
      return <LogsScreen />;
    case 'devtools':
      return <DevToolsScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'about':
      return <AboutScreen />;
    default:
      return <DashboardScreen />;
  }
}

function AppShell(): React.JSX.Element {
  const systemScheme = useColorScheme();
  const { themeMode } = usePlaygroundStore();
  const [section, setSection] = useState<PlaygroundSection>('dashboard');

  useEffect(() => {
    initOtaPlayground();
  }, []);

  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const theme = useMemo(() => (isDark ? playgroundDarkTheme : playgroundLightTheme), [isDark]);

  return (
    <PaperProvider theme={theme}>
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.elevation.level1} />
        <TabStrip active={section} onSelect={setSection} />
        <View style={styles.flex}>{renderSection(section)}</View>
      </SafeAreaView>
    </PaperProvider>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
