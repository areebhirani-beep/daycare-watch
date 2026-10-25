import { describe, expect, it, jest } from '@jest/globals';

type RpcResult = { data: unknown; error: { code: string; details: string; message: string } | null };

const mockRpc = jest.fn<(fn: string, args?: unknown) => Promise<RpcResult>>();
const mockReset = jest.fn(async () => 'fresh-user');

jest.mock('../supabase', () => ({
  supabase: { rpc: mockRpc },
  ensureSession: jest.fn(async () => 'stale-user'),
  resetSession: mockReset,
}));

const deletedUser: RpcResult = {
  data: null,
  error: {
    code: '23503',
    details: 'Key (user_id)=(37f3a045-bb21-44d1-b6c0-22952bbf5869) is not present in table "users".',
    message: 'insert or update on table "devices" violates foreign key constraint "devices_user_id_fkey"',
  },
};

describe('rpc', () => {
  it('retries once as a fresh anonymous user when the session user was deleted', async () => {
    mockRpc.mockResolvedValueOnce(deletedUser).mockResolvedValueOnce({ data: null, error: null });
    const { registerDevice } = jest.requireActual<typeof import('../api')>('../api');
    await registerDevice('ExponentPushToken[x]', 'ios');
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    mockRpc.mockReset();
    mockReset.mockClear();
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', details: '', message: 'permission denied' } });
    const { registerDevice } = jest.requireActual<typeof import('../api')>('../api');
    await expect(registerDevice('ExponentPushToken[x]', 'ios')).rejects.toThrow('register_device: permission denied');
    expect(mockReset).not.toHaveBeenCalled();
  });
});
