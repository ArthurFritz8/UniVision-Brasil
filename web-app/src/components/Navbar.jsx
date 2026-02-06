import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, User, LogOut, Menu, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '@store/authStore';
import useAppStore from '@store/appStore';
import { categoriesAPI, resetSearchCaches } from '@services/api';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuthStore();
  const {
    toggleSidebar,
    theme,
    contentRefresh,
    clearCategoriesCache,
    bumpContentRefresh,
    startContentRefresh,
    setContentRefreshStage,
    finishContentRefresh,
    updateCategoriesCache,
  } = useAppStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pathname = String(location?.pathname || '');
  const isLive = pathname.startsWith('/live');
  const isMovies = pathname.startsWith('/movies');
  const isSeries = pathname.startsWith('/series');

  const searchPlaceholder = isLive
    ? 'Buscar canais (TV ao Vivo)...'
    : isMovies
      ? 'Buscar filmes...'
      : isSeries
        ? 'Buscar séries...'
        : 'Buscar filmes, séries...';

  const handleSearch = (e) => {
    e.preventDefault();
    const q = String(searchQuery || '').trim();
    if (!q) return;

    // Contextual search: filters the current catalog page via URL param.
    if (isLive || isMovies || isSeries) {
      const params = new URLSearchParams(location.search || '');
      params.set('q', q);
      navigate(`${pathname}?${params.toString()}`);
      setSearchQuery('');
      return;
    }

    // Global search (movies + series)
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setSearchQuery('');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRefreshContent = async () => {
    if (contentRefresh?.isRefreshing) return;

    startContentRefresh?.('Atualizando conteúdo: TV ao Vivo, Filmes e Séries. Aguarde…');

    try {
      resetSearchCaches?.();
      clearCategoriesCache?.();

      setContentRefreshStage?.('live', 'Atualizando TV ao Vivo…');
      const live = await categoriesAPI.getAll({ type: 'live' });
      updateCategoriesCache?.('live', live?.categories || []);

      setContentRefreshStage?.('vod', 'Atualizando Filmes…');
      const vod = await categoriesAPI.getAll({ type: 'vod' });
      updateCategoriesCache?.('vod', vod?.categories || []);

      setContentRefreshStage?.('series', 'Atualizando Séries…');
      const series = await categoriesAPI.getAll({ type: 'series' });
      updateCategoriesCache?.('series', series?.categories || []);

      bumpContentRefresh?.();
      toast.success('Conteúdo atualizado!');
    } catch (error) {
      logger.error('navbar.refresh_content_failed', undefined, error);
      toast.error('Falha ao atualizar conteúdo');
    } finally {
      finishContentRefresh?.();
    }
  };

  return (
    <nav className={`sticky top-0 z-50 ${theme === 'dark' ? 'bg-dark-900/95 border-dark-800' : 'bg-white/95 border-gray-200'} backdrop-blur-sm border-b transition-colors duration-300`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Menu */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className={`md:hidden p-2 ${theme === 'dark' ? 'hover:bg-dark-800' : 'hover:bg-gray-200'} rounded-lg transition-colors`}
            >
              <Menu size={24} />
            </button>

            <Link to="/" className="flex items-center gap-2">
              <div className="text-2xl font-bold font-display gradient-text">
                UniVision
              </div>
            </Link>
          </div>

          {/* Center: Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-8 hidden md:block">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} size={20} />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Right: User */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <button
                  onClick={handleRefreshContent}
                  disabled={Boolean(contentRefresh?.isRefreshing)}
                  title="Atualizar conteúdo completo"
                  className={`p-2 rounded-lg transition-colors disabled:opacity-60 ${theme === 'dark' ? 'hover:bg-dark-800' : 'hover:bg-gray-200'}`}
                >
                  <RefreshCw size={20} className={contentRefresh?.isRefreshing ? 'animate-spin' : ''} />
                </button>

                <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden md:block font-medium">{user?.name}</span>
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-12 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 py-2">
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-dark-700 transition-colors"
                      >
                        <User size={18} />
                        <span>Perfil</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-dark-700 transition-colors w-full text-left text-red-400"
                      >
                        <LogOut size={18} />
                        <span>Sair</span>
                      </button>
                    </div>
                  </>
                )}
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="btn-primary"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Search */}
        <form onSubmit={handleSearch} className="md:hidden pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </form>
      </div>
    </nav>
  );
}
