import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '@services/api';

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
          
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          
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
          
          set({
            user: user,
            token: token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          
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
          
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      },
      
      updateProfile: async (data) => {
        try {
          const response = await authAPI.updateProfile(data);
          set({ user: response.data.user });
          return response;
        } catch (error) {
          throw error;
        }
      },
      
      loadUser: async () => {
        try {
          set({ isLoading: true });
          const storedUser = localStorage.getItem('user');
          const token = localStorage.getItem('token');
          
          if (storedUser && token) {
            set({
              user: JSON.parse(storedUser),
              token: token,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ isAuthenticated: false, isLoading: false });
          }
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          localStorage.removeItem('token');
          localStorage.removeItem('user');
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
