import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/** How the scene was found: "place" = Apple matched the daycare by name within 60 m, so it's framed on it. Nothing else is returned. */
export type Facing = 'place';
/** distanceM: how far Apple's matched place is from our point. */
export type LookAroundSnapshot = { uri: string; facing: Facing; distanceM?: number };

type Native = {
  snapshot(
    lat: number,
    lng: number,
    options: { name?: string; width?: number; height?: number; cacheKey?: string },
  ): Promise<LookAroundSnapshot | null>;
  present(lat: number, lng: number, name?: string): Promise<boolean>;
};

// Only in a real iOS build: Expo Go, Android and web have no module, and every call answers null/false.
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Native>('LookAround') : null;

export const lookAroundAvailable = native != null;

export function lookAroundSnapshot(
  lat: number,
  lng: number,
  options: { name?: string; width?: number; height?: number; cacheKey?: string } = {},
): Promise<LookAroundSnapshot | null> {
  return native ? native.snapshot(lat, lng, options) : Promise.resolve(null);
}

export function presentLookAround(lat: number, lng: number, name?: string): Promise<boolean> {
  return native ? native.present(lat, lng, name) : Promise.resolve(false);
}
