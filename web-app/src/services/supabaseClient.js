let clientPromise = null;

export const isSupabaseConfigured = () => {
  try {
    return Boolean(
      String(import.meta.env.VITE_SUPABASE_URL || '').trim() &&
        String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
    );
  } catch {
    return false;
  }
};

export const getSupabaseClient = async () => {
  if (!isSupabaseConfigured()) return null;

  if (!clientPromise) {
    const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    );
  }

  return clientPromise;
};
