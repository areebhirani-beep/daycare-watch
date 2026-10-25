import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * True inside the Expo Go app. Expo Go ships without MMKV, so storage uses its SQLite key-value store
 * instead (see lib/storage.ts).
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
