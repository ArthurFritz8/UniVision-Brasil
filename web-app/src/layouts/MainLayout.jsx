import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from '@components/Navbar';
import Sidebar from '@components/Sidebar';
import useAppStore from '@store/appStore';

export default function MainLayout() {
  const { sidebarCollapsed, theme } = useAppStore();

  useEffect(() => {
    // Aplicar tema ao elemento html
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-dark-950 text-white' : 'bg-white text-black'} flex flex-col transition-colors duration-300`}>
      <Navbar />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main 
          className={`flex-1 overflow-y-auto transition-all duration-300 ${
            sidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
