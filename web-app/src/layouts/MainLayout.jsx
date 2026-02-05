import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from '@components/Navbar';
import Sidebar from '@components/Sidebar';
import useAppStore from '@store/appStore';
import useIptvStore from '@store/iptvStore';
import { warmupIptvCaches } from '@services/warmup';
import { logger } from '@/utils/logger';

export default function MainLayout() {
  const { sidebarCollapsed, theme } = useAppStore();
  const credentials = useIptvStore((s) => s.credentials);

  useEffect(() => {
    const hasCreds = Boolean(
      credentials?.username &&
      credentials?.password &&
      (credentials?.apiUrl || credentials?.m3uUrl)
    );

    if (!hasCreds) return;

    const warmKey = `${String(credentials?.apiUrl || '')}|${String(credentials?.username || '')}`;
    const prev = sessionStorage.getItem('univision:warmupKey');
    if (prev === warmKey) return;
    sessionStorage.setItem('univision:warmupKey', warmKey);

    const run = () => {
      warmupIptvCaches().catch((err) => {
        logger.debug('warmup.run_failed', { message: err?.message });
      });
    };

    // Let initial UI paint first.
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 800);
    }
  }, [credentials?.apiUrl, credentials?.m3uUrl, credentials?.username, credentials?.password]);

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
