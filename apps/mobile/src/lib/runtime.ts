import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * True inside the Expo Go app. Expo Go ships without MMKV, so storage uses its SQLite key-value store
 * instead (see lib/storage.ts).
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * True in the web export (the judges' link). Web is read-only: no anonymous sign-in, watching, push or haptics.
 * Read-only RPCs work with the anon key alone.
 */
export const isWeb = Platform.OS === 'web';
