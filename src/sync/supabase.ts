import { createClient, type Session } from '@supabase/supabase-js';
import type { Remote, RemoteRow } from './engine';

// Public by design: the publishable key only allows what Row Level Security permits
// (each signed-in user can read and write their own rows, nothing else).
const SUPABASE_URL = 'https://grsxgrzbatvubvcsotyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_44laPAJIzcDe9EnCpqPW4g_YqSyfdxS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'trainings-log-auth',
  },
});

export const supabaseRemote: Remote = {
  async push(rows: RemoteRow[]) {
    const { error } = await supabase.rpc('push_records', { rows });
    if (error) throw new Error(error.message);
  },
  async pull(since, limit) {
    let q = supabase
      .from('records')
      .select('table_name,id,data,updated_at,deleted_at,server_ts')
      .order('server_ts', { ascending: true })
      .limit(limit);
    if (since) q = q.gt('server_ts', since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as RemoteRow[];
  },
  async count() {
    const { count, error } = await supabase.from('records').select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
};

export async function sendCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifyCode(email: string, token: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.session) throw new Error(error?.message ?? 'Invalid code');
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}
