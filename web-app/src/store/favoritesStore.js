import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const normalizeType = (rawType) => {
  const t = String(rawType || '').toLowerCase();
  if (t === 'content') return 'movie';
  if (t === 'movie' || t === 'series' || t === 'live') return t;
  if (t === 'channel' || t === 'tv' || t === 'channels') return 'live';
  return t || 'movie';
};

const getKey = (id, type) => `${normalizeType(type)}:${String(id)}`;

const pickFavoriteFields = (item) => {
  const type = normalizeType(item?.type);
  return {
    _id: item?._id,
    type,
    title: item?.title,
    poster: item?.poster ?? item?.logo ?? null,
    logo: item?.logo ?? item?.poster ?? null,
    description: item?.description ?? null,
    year: item?.year ?? null,
    rating: item?.rating ?? null,
    duration: item?.duration ?? null,
    category: item?.category ?? null,
    quality: item?.quality ?? null,
    streamUrl: item?.streamUrl ?? null,
    metadata: item?.metadata ?? undefined,
  };
};

const useFavoritesStore = create(
  persist(
    (set, get) => ({
      favoritesByKey: {},

      isFavorite: (id, type) => {
        if (!id) return false;
        const key = getKey(id, type);
        return Boolean(get().favoritesByKey?.[key]);
      },

      list: () => {
        const map = get().favoritesByKey || {};
        return Object.values(map)
          .filter(Boolean)
          .sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0));
      },

      toggle: (item) => {
        const id = item?._id;
        const type = normalizeType(item?.type);
        if (!id) return;

        const key = getKey(id, type);
        const exists = Boolean(get().favoritesByKey?.[key]);

        if (exists) {
          set((state) => {
            const next = { ...(state.favoritesByKey || {}) };
            delete next[key];
            return { favoritesByKey: next };
          });
          return;
        }

        const base = pickFavoriteFields({ ...item, type });
        set((state) => ({
          favoritesByKey: {
            ...(state.favoritesByKey || {}),
            [key]: { ...base, addedAt: Date.now() },
          },
        }));
      },

      remove: (id, type) => {
        if (!id) return;
        const key = getKey(id, type);
        set((state) => {
          const next = { ...(state.favoritesByKey || {}) };
          delete next[key];
          return { favoritesByKey: next };
        });
      },

      clear: () => set({ favoritesByKey: {} }),
    }),
    {
      name: 'favorites-storage',
      version: 1,
    }
  )
);

export default useFavoritesStore;
