import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { channelsAPI, contentAPI, IPTV_PROXY_BASE_URL } from '../services/api';
import { logger } from '@/utils/logger';

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
            logger.debug('player.sessionStorage.stream_found', { id, url });
          }
        }
        
        // Se não encontrou no sessionStorage, buscar da API
        if (!url) {
          if (type === 'live') {
            // Carregar stream de TV ao vivo
            const response = await channelsAPI.getById(id);
            url = response.channel?.streamUrl;
            logger.debug('player.live.stream_loaded', { id, url });
          } else if (type === 'movie' || type === 'series') {
            // Carregar stream de filme ou série
            const response = await contentAPI.getById(id);
            url = response.content?.streamUrl;
            logger.debug('player.content.stream_loaded', { id, type, url });
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

        logger.debug('player.stream.proxy_url', {
          originalUrl: url,
          proxyUrl: proxyStreamUrl,
          isHlsUrl,
        });
        
        setStreamUrl(proxyStreamUrl);
        setLoading(false);
      } catch (err) {
        logger.error('player.load_stream_failed', { type, id }, err);
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

    logger.debug('player.stream.load', { streamUrl });

    const isHlsStream = streamUrl.includes('/hls?') || /\.m3u8(\?|$)/i.test(streamUrl) || /\.m3u(\?|$)/i.test(streamUrl);

    // Limpar src anterior
    video.pause();
    video.removeAttribute('src');
    video.load();

    // Usar tag nativa com crossOrigin
    video.crossOrigin = 'anonymous';

    let hls;
    let cancelled = false;
    if (isHlsStream) {
      // Safari (e alguns ambientes) suportam HLS nativo
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
      } else {
        // Carregar hls.js sob demanda (reduz bundle inicial)
        (async () => {
          try {
            const mod = await import('hls.js');
            const Hls = mod.default;
            if (cancelled) return;

            if (!Hls?.isSupported?.()) {
              setError('Seu navegador não suporta HLS');
              setLoading(false);
              return;
            }

            hls = new Hls({
              lowLatencyMode: true,
              enableWorker: true,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.ERROR, (_event, data) => {
              logger.error(
                'player.hls.error',
                {
                  type: data?.type,
                  details: data?.details,
                  fatal: data?.fatal,
                  responseCode: data?.response?.code,
                },
                data?.error
              );
            });
          } catch (err) {
            logger.error('player.hls.import_failed', { streamUrl }, err);
            setError('Falha ao inicializar player HLS');
            setLoading(false);
          }
        })();
      }
    } else {
      video.src = streamUrl;
    }
    
    video.addEventListener('play', () => {
      logger.trace('player.video.play');
      setLoading(false);
    }, { once: true });
    
    const onError = (e) => {
      logger.error('player.video.error', {
        code: video.error?.code,
        message: video.error?.message,
        error: e
      });
      setError(`Erro ao carregar vídeo (Código: ${video.error?.code})`);
      setLoading(false);
    };

    video.addEventListener('error', onError);
    
    video.addEventListener('loadstart', () => {
      logger.trace('player.video.loadstart');
    });
    
    video.addEventListener('canplay', () => {
      logger.trace('player.video.canplay');
      setLoading(false);
    });
    
    return () => {
      video.removeEventListener('error', onError);
      cancelled = true;
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
