import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

// daycare_record(1358089) and its daycare_search row (Ivy Kids of Coit, McKinney), captured Oct 25 2026 from the
// local database loaded from data.texas.gov.
import record from '@/fixtures/rpc-daycare_record-1358089.json';
import searchRows from '@/fixtures/rpc-daycare_search-1358089.json';

// A phone with no connection: every RPC comes back the way supabase-js reports a failed fetch.
const mockRpc = jest.fn((..._args: unknown[]) => {
  const failed = Promise.resolve({ data: null, error: { message: 'TypeError: Network request failed' } });
  return Object.assign(failed, { limit: () => failed });
});
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
  configError: null,
  ensureSession: async () => undefined,
  resetSession: async () => undefined,
  onNewUser: () => undefined,
}));
jest.mock('@/lib/storage', () => {
  const m = new Map<string, string>();
  return {
    storage: {
      getString: (k: string) => m.get(k),
      set: (k: string, v: string) => void m.set(k, v),
      remove: (k: string) => void m.delete(k),
    },
  };
});
jest.mock('@/lib/location', () => ({
  findPosition: async () => 'denied',
  savedPosition: () => ({ lat: 33.0198, lng: -96.6989 }),
  forgetPosition: () => undefined,
}));
jest.mock('@/lib/notifications', () => ({
  getPermission: async () => 'granted',
  useAlertsOn: () => false,
}));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({ id: '1358089', eventId: '17' }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const stub: object = new Proxy(() => stub, {
    get: (_t, k) => (k === '__esModule' ? true : k === 'default' || k === 'View' ? (k === 'View' ? View : { View }) : stub),
  });
  return stub;
});

// Map, sheet, imagery and the place page only matter on a device; here they print what they were given.
jest.mock('@/components/ui/HomeMap', () => {
  const { Text } = require('react-native');
  return {
    HomeMap: ({ rows, loading }: { rows: { name: string }[]; loading: boolean }) => (
      <Text>{loading ? 'sheet skeleton' : `${rows.length} daycares: ${rows.map((r) => r.name).join(', ')}`}</Text>
    ),
    rowMeta: () => '',
    rowStrip: () => undefined,
    rowFallback: () => undefined,
  };
});
jest.mock('@/components/ui/DaycareCard', () => {
  const { Text } = require('react-native');
  const Card = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { DaycareCard: Card, PlaceRow: Card };
});
jest.mock('@/components/ui/PlacePage', () => {
  const { Text } = require('react-native');
  return { PlacePage: ({ record: r }: { record: { daycare: { name: string } } }) => <Text>{r.daycare.name}</Text> };
});
jest.mock('@/components/ui/Skeletons', () => {
  const { Text } = require('react-native');
  return { RowSkeleton: () => <Text>row skeleton</Text>, PlaceSkeleton: () => <Text>place skeleton</Text> };
});
jest.mock('@/components/LastWeek', () => {
  const { Text } = require('react-native');
  return {
    LastWeek: () => null,
    VisitRow: ({ visit }: { visit: { display_name: string } }) => <Text>{visit.display_name}</Text>,
    VisitSkeleton: () => <Text>row skeleton</Text>,
  };
});
jest.mock('@/components/ui', () => {
  const { Text } = require('react-native');
  return { LastChecked: () => null, Button: ({ label }: { label: string }) => <Text>{label}</Text> };
});
jest.mock('@/components/ui/Button', () => {
  const { Text } = require('react-native');
  return { Button: ({ label }: { label: string }) => <Text>{label}</Text> };
});
jest.mock('@/components/ui/Glyph', () => ({ Glyph: () => null }));

import Alert from '../app/alert/[eventId]';
import Home from '../app/(tabs)/index';
import Watching from '../app/(tabs)/watching';
import Place from '../app/daycare/[id]/index';
import Week from '../app/week';

const HOUR_AGO = Date.now() - 60 * 60_000;

/** A client as the app has it after the persisted cache is restored: `seed` entries are an hour old, so they refetch. */
async function show(ui: ReactNode, seed: [readonly unknown[], unknown][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  for (const [key, data] of seed) client.setQueryData(key, data, { updatedAt: HOUR_AGO });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}

/**
 * Waits for the refresh to fail, then lets the screen render that failure before anything is asserted
 * (React Query hands results to components on a timer tick, so a microtask flush is not enough).
 */
async function failed(client: QueryClient, key: readonly unknown[]) {
  await waitFor(() => expect(client.getQueryState(key)?.status).toBe('error'));
  await act(() => new Promise((done) => setTimeout(done, 20)));
}

afterEach(() => {
  cleanup();
  mockRpc.mockClear();
});

describe('offline, with the phone’s saved records', () => {
  it('Watching keeps the watched daycares when the refresh fails', async () => {
    const client = await show(<Watching />, [[['my_watches'], searchRows]]);
    await failed(client, ['my_watches']);
    expect(mockRpc).toHaveBeenCalledWith('my_watches', undefined);
    expect(await screen.findByText('Ivy Kids of Coit')).toBeTruthy();
    expect(screen.queryByText(/couldn’t reach/)).toBeNull();
  });

  it('a watched daycare’s record still opens when the refresh fails', async () => {
    const client = await show(<Place />, [[['daycare_record', 1358089], record]]);
    await failed(client, ['daycare_record', 1358089]);
    expect(await screen.findByText('Ivy Kids of Coit')).toBeTruthy();
    expect(screen.queryByText(/couldn’t reach/)).toBeNull();
  });
});

describe('offline, with nothing saved', () => {
  it('Watching says it couldn’t reach the records, never the empty "Watch a daycare" state', async () => {
    const client = await show(<Watching />);
    await failed(client, ['my_watches']);
    expect(await screen.findByText('We couldn’t reach the state records. Check your connection.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.queryByText('Watch a daycare')).toBeNull();
  });

  it('a record that was never opened says so, with Try again', async () => {
    const client = await show(<Place />);
    await failed(client, ['daycare_record', 1358089]);
    expect(await screen.findByText('We couldn’t reach the state record.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('Home shows the connection notice over a skeleton sheet, never "0 daycares"', async () => {
    await show(<Home />);
    expect(await screen.findByText('We couldn’t reach the state records. Check your connection.')).toBeTruthy();
    expect(screen.getByText('sheet skeleton')).toBeTruthy();
    expect(screen.queryByText(/^0 daycares/)).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('daycares_near', { lat: 33.0198, lng: -96.6989, km: 15 });
  });

  it('the week list says it couldn’t reach the records, never an empty week', async () => {
    const client = await show(<Week />);
    await failed(client, ['district_recent_visits', 50]);
    expect(await screen.findByText('We couldn’t reach the state records. Check your connection.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('an alert that never loaded says so, with Try again', async () => {
    const client = await show(<Alert />);
    await failed(client, ['alert_detail', 17]);
    expect(await screen.findByText('We couldn’t load this alert.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
