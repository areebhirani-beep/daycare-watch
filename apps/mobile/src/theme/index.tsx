import { useColorScheme } from 'react-native';

import { dark, light, type Colors } from './tokens';

export * from './tokens';
export { haptic } from './haptics';

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
