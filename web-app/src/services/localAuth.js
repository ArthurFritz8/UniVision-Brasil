const USERS_KEY = 'univision:auth:users:v1';
const SESSION_KEY = 'univision:auth:session:v1';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const b64FromBytes = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const bytesFromB64 = (b64) => {
  const binary = atob(String(b64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const randomB64 = (len = 16) => {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return b64FromBytes(bytes);
};

const newId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `u_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
};

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getUsers = () => {
  const data = readJson(USERS_KEY, { users: [] });
  const users = Array.isArray(data?.users) ? data.users : [];
  return users;
};

const setUsers = (users) => {
  writeJson(USERS_KEY, { users: Array.isArray(users) ? users : [] });
};

const getSession = () => {
  const session = readJson(SESSION_KEY, null);
  if (session?.token && session?.userId) return session;

  // Backwards compatibility if older builds stored token only.
  const token = localStorage.getItem('token');
  if (token) return { token, userId: null };
  return null;
};

const setSession = (session) => {
  writeJson(SESSION_KEY, session);
  if (session?.token) localStorage.setItem('token', session.token);
};

const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem(SESSION_KEY);
};

const pbkdf2Hash = async ({ password, saltB64, iterations = 120000 }) => {
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(password || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const salt = bytesFromB64(saltB64);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    pwKey,
    256
  );

  return b64FromBytes(new Uint8Array(bits));
};

const publicUser = (u) => {
  if (!u) return null;
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role || 'user',
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
};

export const localAuth = {
  register: async ({ name, email, password }) => {
    const cleanName = String(name || '').trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password || '');

    if (!cleanName) throw new Error('Nome é obrigatório');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Email inválido');
    if (cleanPassword.length < 6) throw new Error('Senha deve ter pelo menos 6 caracteres');

    const users = getUsers();
    if (users.some((u) => normalizeEmail(u.email) === cleanEmail)) {
      throw new Error('Este email já está cadastrado');
    }

    const now = new Date().toISOString();
    const saltB64 = randomB64(16);
    const passwordHash = await pbkdf2Hash({ password: cleanPassword, saltB64 });

    const user = {
      _id: newId(),
      name: cleanName,
      email: cleanEmail,
      role: 'user',
      createdAt: now,
      updatedAt: now,
      passwordSalt: saltB64,
      passwordHash,
    };

    setUsers([...users, user]);

    const token = randomB64(24);
    setSession({ token, userId: user._id, createdAt: now });

    localStorage.setItem('user', JSON.stringify(publicUser(user)));

    return { success: true, token, user: publicUser(user) };
  },

  login: async ({ email, password }) => {
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Email inválido');
    if (!cleanPassword) throw new Error('Senha é obrigatória');

    const users = getUsers();
    const user = users.find((u) => normalizeEmail(u.email) === cleanEmail);
    if (!user) throw new Error('Email ou senha incorretos');

    const computed = await pbkdf2Hash({ password: cleanPassword, saltB64: user.passwordSalt });
    if (computed !== user.passwordHash) throw new Error('Email ou senha incorretos');

    const now = new Date().toISOString();
    const token = randomB64(24);
    setSession({ token, userId: user._id, createdAt: now });
    localStorage.setItem('user', JSON.stringify(publicUser(user)));

    return { success: true, token, user: publicUser(user) };
  },

  getMe: async () => {
    const session = getSession();
    if (!session?.token) throw new Error('Não autenticado');

    const users = getUsers();

    let user = null;
    if (session.userId) {
      user = users.find((u) => u._id === session.userId) || null;
    } else {
      // Backwards compatibility: if no userId, trust stored user.
      const stored = readJson('user', null);
      if (stored?._id) user = users.find((u) => u._id === stored._id) || null;
    }

    if (!user) throw new Error('Sessão inválida');

    localStorage.setItem('user', JSON.stringify(publicUser(user)));
    return { user: publicUser(user) };
  },

  updateProfile: async (data) => {
    const session = getSession();
    if (!session?.token) throw new Error('Não autenticado');

    const users = getUsers();
    const idx = session.userId ? users.findIndex((u) => u._id === session.userId) : -1;
    if (idx < 0) throw new Error('Sessão inválida');

    const current = users[idx];

    const newName = data?.name !== undefined ? String(data.name || '').trim() : current.name;
    const newEmailRaw = data?.email !== undefined ? String(data.email || '') : current.email;
    const newEmail = normalizeEmail(newEmailRaw);

    if (!newName) throw new Error('Nome é obrigatório');
    if (!newEmail || !newEmail.includes('@')) throw new Error('Email inválido');

    const emailTaken = users.some((u, i) => i !== idx && normalizeEmail(u.email) === newEmail);
    if (emailTaken) throw new Error('Este email já está em uso');

    const now = new Date().toISOString();
    const updated = {
      ...current,
      name: newName,
      email: newEmail,
      updatedAt: now,
    };

    users[idx] = updated;
    setUsers(users);

    localStorage.setItem('user', JSON.stringify(publicUser(updated)));
    return { success: true, user: publicUser(updated) };
  },

  logout: async () => {
    clearSession();
    return { success: true };
  },

  // For content refresh: keeps auth separate, but handy for debugging.
  _debugListUsers: () => getUsers().map(publicUser),
};
