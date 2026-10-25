import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAlertTaps } from '@/lib/notifications';
import { persister, queryClient, shouldPersist } from '@/lib/query';
import { mark } from '@/lib/perf';
import { isWeb } from '@/lib/runtime';
import { ensureSession } from '@/lib/supabase';
import { dark, font, light } from '@/theme';

void SplashScreen.preventAutoHideAsync();
mark('js start');

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? dark : light;
  useEffect(() => {
    if (!isWeb) void ensureSession().catch(() => undefined);
  }, []);
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  useAlertTaps();

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60_000, dehydrateOptions: { shouldDehydrateQuery: shouldPersist } }}
      >
        <ThemeProvider
          value={{
            ...navTheme,
            colors: { ...navTheme.colors, background: c.bg, card: c.bg, text: c.text, border: c.hairline, primary: c.accent },
          }}
        >
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: c.bg },
              headerTintColor: c.accent,
              headerTitleStyle: { fontFamily: font.semibold, color: c.text },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: c.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="daycare/[id]/watch" options={{ presentation: 'modal', title: 'Watch this daycare' }} />
            <Stack.Screen name="daycare/[id]/tour" options={{ title: 'Tour questions' }} />
            <Stack.Screen name="alert/[eventId]" options={{ title: 'New state record' }} />
            <Stack.Screen name="report" options={{ title: 'Report a concern' }} />
            <Stack.Screen name="week" options={{ title: 'TX-04 last week' }} />
            <Stack.Screen
              name="categories"
              options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true }}
            />
            <Stack.Screen name="search" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="daycare/[id]/index" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
