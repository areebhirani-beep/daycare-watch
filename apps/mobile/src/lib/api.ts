import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { configError, ensureSession, resetSession, supabase } from './supabase';
import type {
  AlertDetail,
  AreaCompare,
  DaycareRecord,
  DaycareRow,
  DistrictPulse,
  LastSync,
} from './types';

// The app reaches data only through the RPCs in CONTRACT.md section 4.
async function rpc<T>(fn: string, args?: Record<string, unknown>, limit?: number): Promise<T> {
  if (configError) throw new Error(configError);
  await ensureSession();
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
  lastSync: ['last_sync'] as const,
};

export function useDaycareRecord(id: number) {
  return useQuery({
    queryKey: keys.record(id),
    queryFn: () => rpc<DaycareRecord>('daycare_record', { p_operation_id: id }),
  });
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
      await rpc<void>(watching ? 'watch' : 'unwatch', { p_operation_id: id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.watches }),
  });
}

export async function registerDevice(token: string, platform: 'ios' | 'android'): Promise<void> {
  await rpc<void>('register_device', { p_expo_push_token: token, p_platform: platform });
}
