import { createClient, isAuthApiError } from '@supabase/supabase-js';
import * as Device from 'expo-device';
import { AppState } from 'react-native';

import { authStorage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env.local');
}

/**
 * Set when the app can't reach the API by design: on a real phone, 127.0.0.1 / localhost is the phone itself.
 * Screens show it instead of loading forever.
 */
export const configError: string | null =
  Device.isDevice && /\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)
    ? `This build points at ${url}, which on a phone is the phone itself. Use the computer's LAN address.`
    : null;

const REQUEST_TIMEOUT_MS = 10_000;

/** Every API call gives up after 10 s, so an unreachable server shows an error instead of an endless skeleton. */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(url, anonKey, {
  global: { fetch: fetchWithTimeout },
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

/**
 * Drop the cached user and start a fresh anonymous session. For a write the server rejects because the
 * signed-in user no longer exists, e.g. after a database reset while the app stayed open.
 */
export async function resetSession(): Promise<string> {
  verifiedUserId = null;
  await supabase.auth.signOut({ scope: 'local' });
  return ensureSession();
}
