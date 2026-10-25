import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';

import { queryStorage } from './storage';
import { onNewUser } from './supabase';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 7 * 24 * 60 * 60_000,
      retry: 2,
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: queryStorage,
  key: 'query-cache-v1',
  throttleTime: 1000,
});

// Persist only what a parent needs offline: their watched daycares and those records.
const PERSISTED = new Set(['my_watches', 'daycare_record', 'area_compare', 'alert_detail', 'last_sync']);

export function shouldPersist(query: Query): boolean {
  const head = query.queryKey[0];
  return query.state.status === 'success' && typeof head === 'string' && PERSISTED.has(head);
}

// Watches and alerts belong to the signed-in user. A new anonymous user must not see the previous one's.
const USER_SCOPED = ['my_watches', 'alert_detail'];

onNewUser(() => {
  for (const head of USER_SCOPED) queryClient.removeQueries({ queryKey: [head] });
});
