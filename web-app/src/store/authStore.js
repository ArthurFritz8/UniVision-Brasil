import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '@services/api';
import useFavoritesStore from './favoritesStore';
import useAppStore from './appStore';
import useIptvStore from './iptvStore';
import { setPersistScopeUserId } from '@services/scopedStorage';

const isSupabaseConfigured = () => {
  try {
    return Boolean(
      String(import.meta.env.VITE_SUPABASE_URL || '').trim() &&
      String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
    );
  } catch {
    return false;
  }
};

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      
      login: async (email, password) => {
        try {
          set({ isLoading: true });
          const response = await authAPI.login({ email, password });
          
          const user = response.user || response.data?.user;
          const token = response.token || response.data?.token;
          
          set({
            user: user,
            token: token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Scope persisted stores by authenticated user
          setPersistScopeUserId(user?._id);
          try {
            await Promise.all([
              useFavoritesStore.persist?.rehydrate?.(),
              useAppStore.persist?.rehydrate?.(),
              useIptvStore.persist?.rehydrate?.(),
            ]);
          } catch {
            // ignore
          }
          
          if (token) localStorage.setItem('token', token);
          else localStorage.removeItem('token');
          if (user) localStorage.setItem('user', JSON.stringify(user));
          
          return response;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      
      register: async (name, email, password) => {
        try {
          set({ isLoading: true });
          const response = await authAPI.register({ name, email, password });
          
          const user = response.user || response.data?.user;
          const token = response.token || response.data?.token;
          const needsEmailConfirmation = Boolean(response?.needsEmailConfirmation);
          
          set({
            user: user,
            token: token,
            isAuthenticated: Boolean(user && !needsEmailConfirmation),
            isLoading: false,
          });

          // Scope persisted stores by authenticated user (if session exists)
          if (user && !needsEmailConfirmation) {
            setPersistScopeUserId(user?._id);
            try {
              await Promise.all([
                useFavoritesStore.persist?.rehydrate?.(),
                useAppStore.persist?.rehydrate?.(),
                useIptvStore.persist?.rehydrate?.(),
              ]);
            } catch {
              // ignore
            }
          }
          
          if (token) localStorage.setItem('token', token);
          else localStorage.removeItem('token');
          if (user) localStorage.setItem('user', JSON.stringify(user));
          
          return response;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
      
      logout: async () => {
        try {
          await authAPI.logout();
        } catch (error) {
          // Ignora erro no logout
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });

          // Switch scope back to anonymous to avoid leaking previous user data
          setPersistScopeUserId('anon');
          try {
            await Promise.all([
              useFavoritesStore.persist?.rehydrate?.(),
              useAppStore.persist?.rehydrate?.(),
              useIptvStore.persist?.rehydrate?.(),
            ]);
          } catch {
            // ignore
          }
          
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      },
      
      updateProfile: async (data) => {
        try {
          const response = await authAPI.updateProfile(data);
          const updatedUser = response?.user || response?.data?.user;
          if (updatedUser) {
            set({ user: updatedUser });
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
          return response;
        } catch (error) {
          // Fallback local (sem backend)
          const current = get().user || {};
          const updatedUser = { ...current, ...(data || {}) };
          set({ user: updatedUser });
          localStorage.setItem('user', JSON.stringify(updatedUser));
          return { success: true, user: updatedUser };
        }
      },
      
      loadUser: async () => {
        try {
          set({ isLoading: true });

          // For Supabase auth, the session is stored internally by Supabase.
          // Don't block loadUser() just because our legacy `token` key is empty.
          const token = localStorage.getItem('token');
          if (!token && !isSupabaseConfigured()) {
            set({ isAuthenticated: false, isLoading: false });
            return;
          }

          // Validate session and load the authoritative user object
          const me = await authAPI.getMe();
          const user = me?.user || me?.data?.user;
          if (!user) {
            set({ isAuthenticated: false, isLoading: false });
            return;
          }

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Ensure stores are scoped to the loaded user (e.g., after refresh)
          setPersistScopeUserId(user?._id);
          try {
            await Promise.all([
              useFavoritesStore.persist?.rehydrate?.(),
              useAppStore.persist?.rehydrate?.(),
              useIptvStore.persist?.rehydrate?.(),
            ]);
          } catch {
            // ignore
          }

          localStorage.setItem('user', JSON.stringify(user));
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          localStorage.removeItem('token');
          localStorage.removeItem('user');

          setPersistScopeUserId('anon');
        }
      },
      
      checkSubscription: () => {
        const { user } = get();
        if (!user?.subscription) return false;
        
        const { isActive, endDate } = user.subscription;
        if (!isActive) return false;
        
        if (endDate && new Date(endDate) < new Date()) {
          return false;
        }
        
        return true;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
