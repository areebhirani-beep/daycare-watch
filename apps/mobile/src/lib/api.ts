import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { forgetPosition } from './location';
import { isWeb } from './runtime';
import { storage, visitStorage } from './storage';
import { configError, ensureSession, resetSession, supabase } from './supabase';
import type {
  AlertDetail,
  AreaCompare,
  DaycareRecord,
  DaycareRow,
  DistrictPulse,
  DistrictRecentVisit,
  LastSync,
} from './types';

// The app reaches data only through the Postgres RPCs in supabase/migrations; no direct table reads.
async function rpc<T>(fn: string, args?: Record<string, unknown>, limit?: number): Promise<T> {
  if (configError) throw new Error(configError);
  if (!isWeb) await ensureSession();
  const call = () => (limit ? supabase.rpc(fn, args).limit(limit) : supabase.rpc(fn, args));
  let { data, error } = await call();
  // 23503 on user_id: the session's user was deleted server-side. Retry once as a fresh anonymous user.
  if (error?.code === '23503' && error.details?.includes('(user_id)')) {
    await resetSession();
    ({ data, error } = await call());
  }
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export const keys = {
  record: (id: number) => ['daycare_record', id] as const,
  area: (id: number) => ['area_compare', id] as const,
  near: (lat: number, lng: number, km: number) => ['daycares_near', lat, lng, km] as const,
  search: (q: string) => ['daycare_search', q] as const,
  watches: ['my_watches'] as const,
  alert: (id: number) => ['alert_detail', id] as const,
  pulse: (week: string | null) => ['district_pulse', week] as const,
  recentVisits: (limit: number) => ['district_recent_visits', limit] as const,
  lastSync: ['last_sync'] as const,
};

export function useDaycareRecord(id: number) {
  return useQuery({
    queryKey: keys.record(id),
    queryFn: () => rpc<DaycareRecord>('daycare_record', { p_operation_id: id }),
  });
}

/**
 * Loads place records ahead of a tap: the first cards on Home (the place opens without a wait) and every watched
 * daycare (persisted, so a parent can open them offline). Cached records are not refetched.
 */
export function usePrefetchRecords(ids: number[]) {
  const qc = useQueryClient();
  const key = ids.join(',');
  useEffect(() => {
    for (const id of key ? key.split(',').map(Number) : []) {
      void qc.prefetchQuery({
        queryKey: keys.record(id),
        queryFn: () => rpc<DaycareRecord>('daycare_record', { p_operation_id: id }),
        staleTime: 5 * 60_000,
      });
    }
  }, [qc, key]);
}

export function useAreaCompare(id: number) {
  return useQuery({
    queryKey: keys.area(id),
    queryFn: () => rpc<AreaCompare | null>('area_compare', { p_operation_id: id }),
  });
}

export function useDaycaresNear(center: { lat: number; lng: number } | null, km = 10) {
  return useQuery({
    queryKey: keys.near(center?.lat ?? 0, center?.lng ?? 0, km),
    // The closest 50 keep the first load small (about 36 KB, against 131 KB for the RPC's 200).
    queryFn: () => rpc<DaycareRow[]>('daycares_near', { lat: center?.lat, lng: center?.lng, km }, 50),
    enabled: center !== null,
    placeholderData: (prev) => prev,
  });
}

export function useDaycareSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: keys.search(trimmed),
    queryFn: () => rpc<DaycareRow[]>('daycare_search', { q: trimmed }),
    enabled: trimmed.length >= 2,
    placeholderData: (prev) => prev,
  });
}

export function useMyWatches() {
  return useQuery({
    queryKey: keys.watches,
    queryFn: () => rpc<DaycareRow[]>('my_watches'),
    // Watching belongs to a signed-in phone; the web link never signs in.
    enabled: !isWeb,
  });
}

export function useAlertDetail(id: number) {
  return useQuery({
    queryKey: keys.alert(id),
    queryFn: () => rpc<AlertDetail>('alert_detail', { p_event_id: id }),
  });
}

export function useDistrictPulse(week: string | null = null) {
  return useQuery({
    queryKey: keys.pulse(week),
    queryFn: () => rpc<DistrictPulse>('district_pulse', { week_start: week }),
  });
}

/** The newest TX-04 visits, up to the end of the last complete week. Homes come back name-free (display_name). */
export function useDistrictRecentVisits(limit = 3) {
  return useQuery({
    queryKey: keys.recentVisits(limit),
    queryFn: () => rpc<DistrictRecentVisit[]>('district_recent_visits', { p_limit: limit }),
  });
}

export function useLastSync() {
  return useQuery({
    queryKey: keys.lastSync,
    queryFn: () => rpc<LastSync>('last_sync'),
    staleTime: 5 * 60_000,
  });
}

export function useIsWatching(id: number): boolean {
  const { data } = useMyWatches();
  return Boolean(data?.some((d) => d.operation_id === id));
}

export function useSetWatch(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (watching: boolean) => {
      if (isWeb) throw new Error('Watching a daycare needs the app.');
      await rpc<void>(watching ? 'watch' : 'unwatch', { p_operation_id: id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.watches }),
  });
}

export async function registerDevice(token: string, platform: 'ios' | 'android'): Promise<void> {
  if (isWeb) return;
  await rpc<void>('register_device', { p_expo_push_token: token, p_platform: platform });
}

/**
 * Hand the phone to the next parent in a test session: stop every watch (so the old anonymous user gets no more
 * pushes), start a fresh anonymous user, forget the saved spot, and show onboarding again.
 */
export async function startOver(): Promise<void> {
  const watched = await rpc<DaycareRow[]>('my_watches');
  await Promise.all(watched.map((d) => rpc<void>('unwatch', { p_operation_id: d.operation_id })));
  await resetSession();
  // Key owned by components/ui/onboarding.ts.
  visitStorage.remove('onboarded.v1');
  storage.remove('push-registered');
  forgetPosition();
}
