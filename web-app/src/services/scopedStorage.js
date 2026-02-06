import { createJSONStorage } from 'zustand/middleware';

const AUTH_SCOPE_KEY = 'univision:auth:scopeUserId:v1';

export const setPersistScopeUserId = (userId) => {
  try {
    const id = String(userId || '').trim();
    localStorage.setItem(AUTH_SCOPE_KEY, id || 'anon');
  } catch {
    // ignore
  }
};

export const getPersistScopeUserId = () => {
  try {
    const id = String(localStorage.getItem(AUTH_SCOPE_KEY) || '').trim();
    return id || 'anon';
  } catch {
    return 'anon';
  }
};

const makeScopedStringStorage = (namespace = 'univision') => {
  const scopedKey = (name) => `${namespace}:persist:${getPersistScopeUserId()}:${name}`;

  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(scopedKey(name));
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(scopedKey(name), value);
      } catch {
        // ignore
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(scopedKey(name));
      } catch {
        // ignore
      }
    },
  };
};

export const createScopedJsonStorage = (namespace = 'univision') =>
  createJSONStorage(() => makeScopedStringStorage(namespace));
