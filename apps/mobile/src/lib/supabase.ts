import { createClient, isAuthApiError } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { authStorage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env.local');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

let verifiedUserId: string | null = null;

/**
 * Anonymous sign-in on first launch, so watching needs no account.
 * A stored session is checked with the server once per launch: if the server no longer knows the user
 * (database reset, or the app now points at a different project), start a fresh anonymous session
 * instead of failing every write. Offline, the stored session is kept so cached records still open.
 */
export async function ensureSession(): Promise<string> {
  if (verifiedUserId) return verifiedUserId;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    const { error } = await supabase.auth.getUser();
    if (!error) return (verifiedUserId = data.session.user.id);
    if (!isAuthApiError(error)) return data.session.user.id;
    await supabase.auth.signOut({ scope: 'local' });
  }
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error || !signed.user) throw error ?? new Error('Anonymous sign-in failed');
  return (verifiedUserId = signed.user.id);
}
