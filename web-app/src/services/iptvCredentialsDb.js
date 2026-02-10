import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { logger } from '@/utils/logger';

const TABLE = 'iptv_credentials';

const toRow = (credentials) => {
  const c = credentials || {};
  return {
    username: String(c.username || '').trim(),
    password: String(c.password || ''),
    api_url: String(c.apiUrl || '').trim(),
    m3u_url: String(c.m3uUrl || '').trim(),
  };
};

const fromRow = (row) => {
  if (!row) return null;
  return {
    username: row.username || '',
    password: row.password || '',
    apiUrl: row.api_url || '',
    m3uUrl: row.m3u_url || '',
  };
};

export const iptvCredentialsDb = {
  isEnabled: () => Boolean(isSupabaseConfigured()),

  getMyCredentials: async () => {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from(TABLE)
      .select('username,password,api_url,m3u_url')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return fromRow(data);
  },

  upsertMyCredentials: async (credentials) => {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase não configurado');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user?.id) throw new Error('Sessão inválida');

    const row = toRow(credentials);

    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: user.id,
          ...row,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    return { success: true };
  },

  clearMyCredentials: async () => {
    const supabase = await getSupabaseClient();
    if (!supabase) return { success: true };

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) return { success: true };

      const { error } = await supabase.from(TABLE).delete().eq('user_id', user.id);
      if (error) throw error;

      return { success: true };
    } catch (err) {
      logger.debug('iptv.credentials_db.clear_failed', { message: err?.message });
      return { success: false };
    }
  },
};
