import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { X } from 'lucide-react';
import { channelsAPI, contentAPI, IPTV_PROXY_BASE_URL } from '../services/api';

export default function Player() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);

  useEffect(() => {
    const loadStream = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let url;
        
        // Primeiro tentar recuperar do sessionStorage
        const sessionData = sessionStorage.getItem('currentItem');
        if (sessionData) {
          const item = JSON.parse(sessionData);
          if (item.streamUrl) {
            url = item.streamUrl;
            console.log('✅ Stream encontrada no sessionStorage:', { id, url });
          }
        }
        
        // Se não encontrou no sessionStorage, buscar da API
        if (!url) {
          if (type === 'live') {
            // Carregar stream de TV ao vivo
            const response = await channelsAPI.getById(id);
            url = response.channel?.streamUrl;
            console.log('📺 Stream de TV:', { id, url });
          } else if (type === 'movie' || type === 'series') {
            // Carregar stream de filme ou série
            const response = await contentAPI.getById(id);
            url = response.content?.streamUrl;
            console.log('🎬 Stream de conteúdo:', { id, type, url });
          }
        }
        
        if (!url) {
          setError('URL de stream não encontrada');
          setLoading(false);
          return;
        }

        const isHlsUrl = /\.m3u8(\?|$)/i.test(url) || /\.m3u(\?|$)/i.test(url);

        // Usar proxy para fazer streaming (proxy segue redirects e adiciona CORS)
        // Para HLS, usar /hls para reescrever playlist e proxiar segmentos/keys.
        const proxyStreamUrl = isHlsUrl
          ? `${IPTV_PROXY_BASE_URL}/hls?url=${encodeURIComponent(url)}`
          : `${IPTV_PROXY_BASE_URL}/stream?url=${encodeURIComponent(url)}`;
        console.log('🔗 Stream URL original:', url);
        console.log('🎬 Stream via proxy:', proxyStreamUrl);
        
        setStreamUrl(proxyStreamUrl);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar stream:', err);
        setError(err.message || 'Erro ao carregar stream');
        setLoading(false);
      }
    };
    
    loadStream();
  }, [type, id]);

  useEffect(() => {
    if (!streamUrl) return;
    
    const video = document.getElementById('video-player');
    if (!video) return;

    console.log('🎬 Carregando stream:', streamUrl);

    const isHlsStream = streamUrl.includes('/hls?') || /\.m3u8(\?|$)/i.test(streamUrl) || /\.m3u(\?|$)/i.test(streamUrl);

    // Limpar src anterior
    video.pause();
    video.removeAttribute('src');
    video.load();

    // Usar tag nativa com crossOrigin
    video.crossOrigin = 'anonymous';

    let hls;
    if (isHlsStream) {
      // Safari (e alguns ambientes) suportam HLS nativo
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
      } else if (Hls.isSupported()) {
        hls = new Hls({
          lowLatencyMode: true,
          enableWorker: true,
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
      } else {
        setError('Seu navegador não suporta HLS');
        setLoading(false);
        return;
      }
    } else {
      video.src = streamUrl;
    }
    
    video.addEventListener('play', () => {
      console.log('▶️ Vídeo iniciando reprodução');
      setLoading(false);
    }, { once: true });
    
    const onError = (e) => {
      console.error('❌ Erro na tag video:', {
        code: video.error?.code,
        message: video.error?.message,
        error: e
      });
      setError(`Erro ao carregar vídeo (Código: ${video.error?.code})`);
      setLoading(false);
    };

    video.addEventListener('error', onError);
    
    video.addEventListener('loadstart', () => {
      console.log('⏳ Iniciando carregamento do stream');
    });
    
    video.addEventListener('canplay', () => {
      console.log('✅ Vídeo pronto para reproduzir');
      setLoading(false);
    });
    
    return () => {
      video.removeEventListener('error', onError);
      if (hls) {
        try {
          hls.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [streamUrl]);

  return (
    <div className="h-screen bg-black flex items-center justify-center relative">
      {/* Botão de fechar */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 right-4 z-50 bg-dark-900/80 hover:bg-dark-800 p-2 rounded-lg transition-colors"
        title="Fechar player"
      >
        <X size={24} className="text-white" />
      </button>

      <div className="max-w-7xl w-full h-full relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-40">
            <div className="text-center">
              <div className="animate-spin mb-4">
                <div className="spinner" />
              </div>
              <p className="text-gray-200">Carregando stream...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-40">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        <video
          id="video-player"
          className="w-full h-full"
          controls
          autoPlay
          crossOrigin="anonymous"
        >
          Seu navegador não suporta video HTML5.
        </video>
      </div>
    </div>
  );
}
