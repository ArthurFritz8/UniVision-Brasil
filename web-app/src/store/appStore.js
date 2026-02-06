import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createScopedJsonStorage } from '@services/scopedStorage';

const useAppStore = create(
  persist(
    (set) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark'
      })),
      
      // Sidebar
      sidebarCollapsed: window.innerWidth < 768,
      toggleSidebar: () => set((state) => ({
        sidebarCollapsed: !state.sidebarCollapsed
      })),
      
      // Active category (para manter categoria selecionada ao navegar)
      activeCategory: null,
      setActiveCategory: (categoryId) => set({ activeCategory: categoryId }),
      
      // Cache de categorias para evitar recarregamentos
      categoriesCache: {
        live: null,
        vod: null,
        series: null,
        lastUpdate: null,
      },
      updateCategoriesCache: (type, categories) => set((state) => ({
        categoriesCache: {
          ...state.categoriesCache,
          [type]: categories,
          lastUpdate: Date.now(),
        }
      })),

      clearCategoriesCache: () => set(() => ({
        categoriesCache: {
          live: null,
          vod: null,
          series: null,
          lastUpdate: null,
        },
      })),

      // Content refresh (forces pages to refetch and clear local refs)
      contentRefreshNonce: 0,
      bumpContentRefresh: () => set((state) => ({
        contentRefreshNonce: Number(state.contentRefreshNonce || 0) + 1,
      })),

      contentRefresh: {
        isRefreshing: false,
        stage: '',
        message: '',
      },
      startContentRefresh: (message) => set(() => ({
        contentRefresh: {
          isRefreshing: true,
          stage: 'init',
          message: String(message || 'Atualizando conteúdo...'),
        }
      })),
      setContentRefreshStage: (stage, message) => set((state) => ({
        contentRefresh: {
          ...state.contentRefresh,
          isRefreshing: true,
          stage: String(stage || ''),
          message: String(message || state.contentRefresh?.message || ''),
        }
      })),
      finishContentRefresh: () => set((state) => ({
        contentRefresh: {
          ...state.contentRefresh,
          isRefreshing: false,
          stage: 'done',
        }
      })),
      
      // Player settings
      playerSettings: {
        autoplay: true,
        quality: 'auto',
        volume: 1,
        muted: false,
        subtitles: true,
      },
      setPlayerSettings: (settings) => set((state) => ({
        playerSettings: { ...state.playerSettings, ...settings }
      })),
      
      // Search history
      searchHistory: [],
      addSearchTerm: (term) => set((state) => ({
        searchHistory: [term, ...state.searchHistory.filter(t => t !== term)].slice(0, 10)
      })),
      clearSearchHistory: () => set({ searchHistory: [] }),
      
      // Recently viewed
      recentlyViewed: [],
      addRecentlyViewed: (item) => set((state) => {
        const filtered = state.recentlyViewed.filter(i => i._id !== item._id);
        return {
          recentlyViewed: [item, ...filtered].slice(0, 20)
        };
      }),
      clearRecentlyViewed: () => set({ recentlyViewed: [] }),
      
      // Continue watching
      continueWatching: [],
      updateContinueWatching: (items) => set({ continueWatching: items }),
      
      // Active category
      activeCategory: null,
      setActiveCategory: (category) => set({ activeCategory: category }),
      
      // Loading states
      isLoading: false,
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'app-storage',
      storage: createScopedJsonStorage('univision'),
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        playerSettings: state.playerSettings,
        searchHistory: state.searchHistory,
        recentlyViewed: state.recentlyViewed,
      }),
    }
  )
);

export default useAppStore;
