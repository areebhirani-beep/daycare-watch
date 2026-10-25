import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * How the scene was found. "place": Apple matched the daycare by name within 60 m, so it's framed on the building.
 * "point" (only with allowPoint): the street nearest the state's address point, looking at it; it may show a
 * neighbouring building, so the app labels it as the street at the address, never as the daycare.
 */
export type Facing = 'place' | 'point';
/** distanceM: how far Apple's matched place is from our point ("place" only). */
export type LookAroundSnapshot = { uri: string; facing: Facing; distanceM?: number };

type Options = { name?: string; width?: number; height?: number; cacheKey?: string; allowPoint?: boolean };

type Native = {
  snapshot(lat: number, lng: number, options: Options): Promise<LookAroundSnapshot | null>;
  present(lat: number, lng: number, name: string | undefined, allowPoint: boolean): Promise<boolean>;
};

// Only in a real iOS build: Expo Go, Android and web have no module, and every call answers null/false.
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Native>('LookAround') : null;

export const lookAroundAvailable = native != null;

export function lookAroundSnapshot(lat: number, lng: number, options: Options = {}): Promise<LookAroundSnapshot | null> {
  return native ? native.snapshot(lat, lng, options) : Promise.resolve(null);
}

export function presentLookAround(lat: number, lng: number, name?: string, allowPoint = false): Promise<boolean> {
  return native ? native.present(lat, lng, name, allowPoint) : Promise.resolve(false);
}
