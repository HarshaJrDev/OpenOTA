import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const playgroundLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#3454D1',
    secondary: '#00897B',
  },
};

export const playgroundDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#8AA5FF',
    secondary: '#4DB6AC',
  },
};

export const stateColors = {
  EMBEDDED: '#9E9E9E',
  DOWNLOADED: '#42A5F5',
  VERIFIED: '#26A69A',
  EXTRACTED: '#7E57C2',
  INSTALLED: '#5C6BC0',
  ACTIVATED: '#43A047',
  FAILED: '#E53935',
  ROLLBACK: '#FB8C00',
} as const;

export const logLevelColors = {
  debug: '#78909C',
  info: '#42A5F5',
  warn: '#FB8C00',
  error: '#E53935',
} as const;

export const logSourceColors = {
  sdk: '#5C6BC0',
  native: '#26A69A',
  server: '#8E24AA',
  app: '#546E7A',
} as const;
