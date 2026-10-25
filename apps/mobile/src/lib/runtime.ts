import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * True inside the Expo Go app. Expo Go ships without MapLibre and MMKV, so those native modules are
 * loaded only when this is false: Find shows the list without the map, and storage lives in memory.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
