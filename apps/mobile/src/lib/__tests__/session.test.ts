import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

type Auth = {
  getSession: jest.Mock<() => Promise<unknown>>;
  getUser: jest.Mock<() => Promise<unknown>>;
  signOut: jest.Mock<(opts?: unknown) => Promise<unknown>>;
  signInAnonymously: jest.Mock<() => Promise<unknown>>;
  startAutoRefresh: jest.Mock;
  stopAutoRefresh: jest.Mock;
};

let mockAuth: Auth;

jest.mock('@supabase/supabase-js', () => {
  const actual = jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
  return { ...actual, createClient: () => ({ auth: mockAuth }) };
});
jest.mock('../storage', () => ({ authStorage: {} }));

const stored = { session: { user: { id: 'stored-user' } } };
const fresh = { user: { id: 'fresh-user' } };

function load(): typeof import('../supabase') {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:55321';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  let mod!: typeof import('../supabase');
  jest.isolateModules(() => {
    mod = jest.requireActual<typeof import('../supabase')>('../supabase');
  });
  return mod;
}

beforeEach(() => {
  mockAuth = {
    getSession: jest.fn(async () => ({ data: stored })),
    getUser: jest.fn(async () => ({ data: { user: stored.session.user }, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
    signInAnonymously: jest.fn(async () => ({ data: fresh, error: null })),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
});

describe('ensureSession', () => {
  it('keeps a stored session the server still knows, and checks it once per launch', async () => {
    const { ensureSession } = load();
    expect(await ensureSession()).toBe('stored-user');
    expect(await ensureSession()).toBe('stored-user');
    expect(mockAuth.getUser).toHaveBeenCalledTimes(1);
    expect(mockAuth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('starts a fresh anonymous session when the server no longer knows the stored user', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found'),
    });
    const { ensureSession } = load();
    expect(await ensureSession()).toBe('fresh-user');
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the stored session offline, and checks again on the next call', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('Network request failed', 0) });
    const { ensureSession } = load();
    expect(await ensureSession()).toBe('stored-user');
    await ensureSession();
    expect(mockAuth.getUser).toHaveBeenCalledTimes(2);
    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(mockAuth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously on first launch', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    const { ensureSession } = load();
    expect(await ensureSession()).toBe('fresh-user');
    expect(mockAuth.getUser).not.toHaveBeenCalled();
  });
});
