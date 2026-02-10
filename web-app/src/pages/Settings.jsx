import { Moon, Sun, Wifi, Save, Trash2, TestTube } from 'lucide-react';
import { useState } from 'react';
import useAppStore from '@store/appStore';
import useIptvStore from '@store/iptvStore';
import toast from 'react-hot-toast';
import { IPTV_PROXY_BASE_URL, categoriesAPI, resetSearchCaches } from '@services/api';
import { logger } from '@/utils/logger';
import { iptvCredentialsDb } from '@services/iptvCredentialsDb';

export default function Settings() {
  const {
    theme,
    toggleTheme,
    playerSettings,
    setPlayerSettings,
    clearCategoriesCache,
    bumpContentRefresh,
    startContentRefresh,
    setContentRefreshStage,
    finishContentRefresh,
    updateCategoriesCache,
  } = useAppStore();
  const { credentials, setCredentials, clearCredentials } = useIptvStore();
  const [formData, setFormData] = useState({ username: '', password: '', apiUrl: '', m3uUrl: '' });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSaveCredentials = async () => {
    try {
      setCredentials(formData);
      if (iptvCredentialsDb.isEnabled()) {
        await iptvCredentialsDb.upsertMyCredentials(formData);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      logger.error('pages.settings.save_credentials_failed', undefined, error);
      toast.error('Falha ao salvar credenciais');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const creds = credentials;
      if (!creds?.username || !creds?.password || !creds?.apiUrl) {
        toast.error('Credenciais incompletas!');
        return;
      }

      // Construir URL
      let baseUrl = creds.apiUrl;
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = 'http://' + baseUrl;
      }
      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }
      
      // Use a lightweight action for testing. `get_live_streams` is often huge and can timeout.
      const fullUrl = `${baseUrl}player_api.php?username=${creds.username}&password=${creds.password}&action=get_live_categories`;
      
      // USAR PROXY
      const proxyUrl = `${IPTV_PROXY_BASE_URL}/iptv?url=${encodeURIComponent(fullUrl)}`;
      
      logger.debug('pages.settings.test_connection.request', { proxyUrl });
      toast('Testando via proxy...', { icon: '🔄' });
      
      const response = await fetch(proxyUrl);
      logger.debug('pages.settings.test_connection.response', { status: response.status });
      
      if (response.ok) {
        const jsonData = await response.json();
        logger.debug('pages.settings.test_connection.ok', {
          type: typeof jsonData,
          count: Array.isArray(jsonData) ? jsonData.length : undefined,
        });
        const count = Array.isArray(jsonData) ? jsonData.length : 0;
        toast.success(`✅ Conexão OK! ${count} categorias encontradas`);
      } else {
        const errorText = await response.text();
        logger.warn('pages.settings.test_connection.http_error', { status: response.status, errorText });
        toast.error(`Erro: ${response.status}`);
      }
    } catch (error) {
      logger.error('pages.settings.test_connection.failed', undefined, error);
      toast.error(`Falha: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleClearCredentials = () => {
    (async () => {
      try {
        clearCredentials();
        if (iptvCredentialsDb.isEnabled()) {
          await iptvCredentialsDb.clearMyCredentials();
        }
        setFormData({ username: '', password: '', apiUrl: '', m3uUrl: '' });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        logger.error('pages.settings.clear_credentials_failed', undefined, error);
        toast.error('Falha ao limpar credenciais');
      }
    })();
  };

  const handleRefreshContent = async () => {
    if (refreshing) return;

    setRefreshing(true);
    startContentRefresh('Atualizando conteúdo: TV ao Vivo, Filmes e Séries. Aguarde…');

    try {
      // Reset client caches and force pages to refetch
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

      // Now force pages to clear their local refs and reload with fresh data.
      bumpContentRefresh?.();

      toast.success('Conteúdo atualizado!');
    } catch (error) {
      logger.error('pages.settings.refresh_content_failed', undefined, error);
      toast.error('Falha ao atualizar conteúdo');
    } finally {
      finishContentRefresh?.();
      setRefreshing(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const bgClass = theme === 'dark' ? 'bg-dark-950' : 'bg-gray-50';
  const cardClass = theme === 'dark' ? 'bg-dark-900 border-dark-700' : 'bg-white border-gray-200';
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const mutedClass = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-300`}>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className={`text-5xl font-bold mb-2 ${textClass}`}>⚙️ Configurações</h1>
          <p className={`text-lg ${mutedClass}`}>Personalize sua experiência</p>
        </div>

        {/* Success Message */}
        {saved && (
          <div className={`mb-8 p-4 rounded-lg border-l-4 ${theme === 'dark' ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-green-50 border-green-500 text-green-700'}`}>
            <p className="font-semibold">✓ Configurações salvas com sucesso!</p>
          </div>
        )}

        <div className="space-y-8">
          
          {/* Aparência */}
          <section className={`rounded-2xl p-8 border-2 ${cardClass}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-primary-600/20' : 'bg-primary-100'}`}>
                  {theme === 'dark' ? <Moon size={28} className="text-primary-400" /> : <Sun size={28} className="text-primary-600" />}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${textClass}`}>Aparência</h2>
                  <p className={`text-sm ${mutedClass}`}>Tema {theme === 'dark' ? 'Escuro' : 'Claro'}</p>
                </div>
              </div>
              <button onClick={toggleTheme} className="btn-primary px-8 py-3 text-base font-semibold hover:scale-105 transition-transform">
                Alternar
              </button>
            </div>
          </section>

          {/* IPTV Credenciais */}
          <section className={`rounded-2xl p-8 border-2 ${cardClass}`}>
            <div className="flex items-center gap-4 mb-8">
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-primary-600/20' : 'bg-primary-100'}`}>
                <Wifi size={28} className="text-primary-500" />
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${textClass}`}>Credenciais IPTV</h2>
                <p className={`text-sm ${mutedClass}`}>Configure suas credenciais</p>
              </div>
            </div>

            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-dark-950/50' : 'bg-gray-50'} grid grid-cols-1 md:grid-cols-2 gap-6`}>
              
              <div>
                <label className={`block text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>👤 Usuário</label>
                <input type="text" placeholder="seu.email@exemplo.com" value={formData.username} onChange={(e) => handleInputChange('username', e.target.value)} className="input-field" />
              </div>

              <div>
                <label className={`block text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>🔐 Senha</label>
                <input type="password" placeholder="sua senha" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} className="input-field" />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>🌐 URL da API</label>
                <input type="text" placeholder="https://api.seuprovedor.com" value={formData.apiUrl} onChange={(e) => handleInputChange('apiUrl', e.target.value)} className="input-field" />
                <p className={`text-xs mt-2 ${mutedClass}`}>Ex: https://tvonline.com/api</p>
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>📺 URL M3U</label>
                <input type="text" placeholder="https://seu-servidor.com/lista.m3u" value={formData.m3uUrl} onChange={(e) => handleInputChange('m3uUrl', e.target.value)} className="input-field" />
                <p className={`text-xs mt-2 ${mutedClass}`}>Lista de canais em formato M3U</p>
              </div>

            </div>

            <div className={`flex gap-3 mt-8 pt-6 border-t ${theme === 'dark' ? 'border-dark-700/50' : 'border-gray-300/50'}`}>
              <button onClick={handleSaveCredentials} className="flex-1 btn-primary py-3 font-semibold rounded-lg hover:scale-105 transition-transform flex items-center justify-center gap-2">
                <Save size={20} /> Salvar
              </button>
              <button onClick={handleTestConnection} disabled={testing} className="btn-secondary px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-50">
                <TestTube size={20} /> {testing ? 'Testando...' : 'Testar'}
              </button>
              {(formData.username || formData.password || formData.apiUrl || formData.m3uUrl) && (
                <button onClick={handleClearCredentials} className="btn-secondary px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-80 transition-opacity">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </section>

          {/* Player */}
          <section className={`rounded-2xl p-8 border-2 ${cardClass}`}>
            <div className="flex items-center gap-4 mb-8">
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-primary-600/20' : 'bg-primary-100'}`}>
                <span className="text-3xl">🎬</span>
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${textClass}`}>Player de Vídeo</h2>
                <p className={`text-sm ${mutedClass}`}>Configure o player</p>
              </div>
            </div>

            <div className="space-y-4">
              
              <div className={`flex items-center justify-between p-5 rounded-lg border-2 ${cardClass}`}>
                <div>
                  <p className={`font-semibold text-lg ${textClass}`}>▶️ Autoplay</p>
                  <p className={`text-sm ${mutedClass}`}>Reproduzir automaticamente</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={playerSettings.autoplay} onChange={(e) => setPlayerSettings({ autoplay: e.target.checked })} className="sr-only peer" />
                  <div className={`w-12 h-7 rounded-full peer transition-all ${playerSettings.autoplay ? 'bg-primary-600' : theme === 'dark' ? 'bg-dark-700' : 'bg-gray-300'} peer-checked:after:translate-x-6 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                </label>
              </div>

              <div className={`flex items-center justify-between p-5 rounded-lg border-2 ${cardClass}`}>
                <div>
                  <p className={`font-semibold text-lg ${textClass}`}>📝 Legendas</p>
                  <p className={`text-sm ${mutedClass}`}>Ativar legendas</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={playerSettings.subtitles} onChange={(e) => setPlayerSettings({ subtitles: e.target.checked })} className="sr-only peer" />
                  <div className={`w-12 h-7 rounded-full peer transition-all ${playerSettings.subtitles ? 'bg-primary-600' : theme === 'dark' ? 'bg-dark-700' : 'bg-gray-300'} peer-checked:after:translate-x-6 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                </label>
              </div>

            </div>
          </section>

          {/* Conteúdo */}
          <section className={`rounded-2xl p-8 border-2 ${cardClass}`}>
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-primary-600/20' : 'bg-primary-100'}`}>
                <span className="text-3xl">🔄</span>
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${textClass}`}>Conteúdo</h2>
                <p className={`text-sm ${mutedClass}`}>Recarregar categorias e listas</p>
              </div>
            </div>

            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-dark-950/50' : 'bg-gray-50'}`}>
              <p className={`${mutedClass} text-sm mb-4`}>
                Use este botão quando houver novos canais/filmes/séries. Ele limpa caches e força o app a buscar novamente.
              </p>

              <button
                onClick={handleRefreshContent}
                disabled={refreshing}
                className="btn-primary px-8 py-3 text-base font-semibold hover:scale-105 transition-transform disabled:opacity-60"
              >
                {refreshing ? 'Atualizando...' : 'Atualizar conteúdo completo'}
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
