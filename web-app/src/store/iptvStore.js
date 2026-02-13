import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createScopedJsonStorage } from '@services/scopedStorage';

const useIptvStore = create(
  persist(
    (set) => ({
      credentials: {
        username: '',
        password: '',
        apiUrl: '',
        m3uUrl: '',
      },

      setCredentials: (newCredentials) =>
        set((state) => ({
          credentials: {
            ...state.credentials,
            ...newCredentials,
          },
        })),

      clearCredentials: () =>
        set({
          credentials: {
            username: '',
            password: '',
            apiUrl: '',
            m3uUrl: '',
          },
        }),

      hasCredentials: () => {
        const store = useIptvStore.getState();
        const hasXtream = Boolean(
          store.credentials.username &&
            store.credentials.password &&
            store.credentials.apiUrl
        );
        const hasM3u = Boolean(String(store.credentials.m3uUrl || '').trim());
        return hasXtream || hasM3u;
      },
    }),
    {
      name: 'iptv-credentials',
      storage: createScopedJsonStorage('univision'),
      partialize: (state) => ({ credentials: state.credentials }),
    }
  )
);

export default useIptvStore;
