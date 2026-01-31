import { Link, useLocation } from 'react-router-dom';
import { Home, Tv, Film, BookOpen, Heart, Settings, Menu, X } from 'lucide-react';
import useAppStore from '@store/appStore';
import useAuthStore from '@store/authStore';

export default function Sidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, theme } = useAppStore();
  const { isAuthenticated } = useAuthStore();

  const navItems = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/live', icon: Tv, label: 'TV ao Vivo' },
    { path: '/movies', icon: Film, label: 'Filmes' },
    { path: '/series', icon: BookOpen, label: 'Séries' },
    { path: '/favorites', icon: Heart, label: 'Favoritos', protected: true },
    { path: '/settings', icon: Settings, label: 'Configurações', protected: true },
  ];

  const filteredItems = navItems.filter(item => !item.protected || isAuthenticated);

  return (
    <>
      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] ${theme === 'dark' ? 'bg-dark-900 border-dark-800' : 'bg-gray-100 border-gray-300'} border-r z-50 transition-all duration-300 ${
          sidebarCollapsed 
            ? '-translate-x-full md:translate-x-0 md:w-16' 
            : 'translate-x-0 w-64'
        }`}
      >
        <nav className="p-4 space-y-2">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 768 && toggleSidebar()}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth no-select ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : theme === 'dark' ? 'text-gray-300 hover:bg-dark-800' : 'text-gray-700 hover:bg-gray-200'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <Icon size={20} />
                {!sidebarCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Toggle button (desktop) */}
        <button
          onClick={toggleSidebar}
          className={`hidden md:block absolute -right-3 top-4 ${theme === 'dark' ? 'bg-dark-800 border-dark-700 hover:bg-dark-700' : 'bg-gray-200 border-gray-300 hover:bg-gray-300'} p-1.5 rounded-full border transition-colors`}
        >
          {sidebarCollapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </aside>
    </>
  );
}
