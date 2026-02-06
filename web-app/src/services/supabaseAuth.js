let clientPromise = null;

const getSupabaseEnv = () => {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return { url, anonKey, enabled: Boolean(url && anonKey) };
};

const getClient = async () => {
  const { url, anonKey, enabled } = getSupabaseEnv();
  if (!enabled) return null;

  if (!clientPromise) {
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

const mapUser = (u) => {
  if (!u) return null;
  const name =
    u?.user_metadata?.name ||
    u?.user_metadata?.full_name ||
    u?.email ||
    'Usuário';

  return {
    _id: u.id,
    name,
    email: u.email,
    role: 'user',
    createdAt: u.created_at,
    updatedAt: u.updated_at || u.created_at,
  };
};

export const supabaseAuth = {
  isEnabled: () => getSupabaseEnv().enabled,

  register: async ({ name, email, password }) => {
    const supabase = await getClient();
    if (!supabase) throw new Error('Supabase não configurado');

    const { data, error } = await supabase.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: {
        data: { name: String(name || '').trim() },
      },
    });

    if (error) throw error;

    // data.session can be null when email confirmation is enabled
    const token = data?.session?.access_token || null;
    const user = mapUser(data?.user);

    return {
      success: true,
      token,
      user,
      needsEmailConfirmation: !data?.session,
    };
  },

  login: async ({ email, password }) => {
    const supabase = await getClient();
    if (!supabase) throw new Error('Supabase não configurado');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || ''),
    });

    if (error) throw error;

    return {
      success: true,
      token: data?.session?.access_token,
      user: mapUser(data?.user),
    };
  },

  logout: async () => {
    const supabase = await getClient();
    if (!supabase) return { success: true };

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  },

  getMe: async () => {
    const supabase = await getClient();
    if (!supabase) throw new Error('Supabase não configurado');

    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    return { user: mapUser(data?.user) };
  },

  updateProfile: async ({ name }) => {
    const supabase = await getClient();
    if (!supabase) throw new Error('Supabase não configurado');

    const { data, error } = await supabase.auth.updateUser({
      data: {
        name: String(name || '').trim(),
      },
    });

    if (error) throw error;
    return { success: true, user: mapUser(data?.user) };
  },
};
