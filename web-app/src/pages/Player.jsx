import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { channelsAPI, contentAPI, IPTV_PROXY_BASE_URL } from '../services/api';
import { logger } from '@/utils/logger';

const mediaErrorMessage = (video) => {
  const code = video?.error?.code;
  switch (code) {
    case 1:
      return 'Reprodução abortada';
    case 2:
      return 'Erro de rede ao carregar o stream';
    case 3:
      return 'Erro ao decodificar (codec/stream incompatível)';
    case 4:
      return 'Formato de mídia não suportado pelo navegador';
    default:
      return 'Erro ao reproduzir';
  }
};

const detectKindFromBytes = (bytes, contentType) => {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('mpegurl') || ct.includes('application/vnd.apple.mpegurl') || ct.includes('application/x-mpegurl')) {
    return 'hls';
  }
  if (ct.includes('mp2t') || ct.includes('mpegts') || ct.includes('video/mp2t')) {
    return 'ts';
  }

  if (!bytes || bytes.length < 16) return 'unknown';

  // HLS playlists are plain text and begin with #EXTM3U
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const trimmed = text.replace(/^\uFEFF/, '').trimStart();
    if (trimmed.startsWith('#EXTM3U')) return 'hls';
  } catch {
    // ignore
  }

  // MPEG-TS has sync byte 0x47 at 188-byte intervals
  // We check first byte and a couple of likely packet boundaries.
  const isSync = (idx) => idx < bytes.length && bytes[idx] === 0x47;
  if (isSync(0) && (isSync(188) || isSync(376) || isSync(564))) return 'ts';

  return 'unknown';
};

const safeDecodeText = (bytes, maxChars = 600) => {
  if (!bytes || bytes.length === 0) return '';
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    return trimmed.slice(0, maxChars);
  } catch {
    return '';
  }
};

const copyToClipboard = async (text) => {
  const value = String(text || '').trim();
  if (!value) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to legacy
  }

  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return !!ok;
  } catch {
    return false;
  }
};

const openInVlcAndroid = (url) => {
  const target = String(url || '').trim();
  if (!target) return false;

  const ua = String(navigator?.userAgent || '').toLowerCase();
  const isAndroid = ua.includes('android');
  if (!isAndroid) return false;

  // Best-effort Android intent for VLC
  // Note: Not all browsers/devices handle intent URLs the same way.
  const intentUrl = `intent://${encodeURIComponent(target)}#Intent;scheme=https;package=org.videolan.vlc;end`;
  try {
    window.location.href = intentUrl;
    return true;
  } catch {
    return false;
  }
};

const probeStreamViaProxy = async ({ originalUrl, timeoutMs = 3500 }) => {
  // Fetch a small chunk via /stream (no CORS issues) and inspect headers/body.
  const probeUrl = `${IPTV_PROXY_BASE_URL}/stream?url=${encodeURIComponent(originalUrl)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(probeUrl, {
      method: 'GET',
      signal: controller.signal,
      // Avoid reusing cached errors for probes
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') || '';

    let bytes = null;
    let snippet = '';

    // Some servers respond with playlists but without body streaming support.
    if (!res.body) {
      return {
        kind: detectKindFromBytes(null, contentType),
        status: res.status,
        contentType,
        snippet,
      };
    }

    const reader = res.body.getReader();
    const { value } = await reader.read();
    try {
      await reader.cancel();
    } catch {
      // ignore
    }

    bytes = value ? new Uint8Array(value) : null;
    snippet = safeDecodeText(bytes);
    return {
      kind: detectKindFromBytes(bytes, contentType),
      status: res.status,
      contentType,
      snippet,
    };
  } catch (err) {
    logger.warn('player.stream.probe_failed', { message: err?.message });
    return {
      kind: 'unknown',
      status: null,
      contentType: '',
      snippet: '',
      errorMessage: err?.message,
    };
  } finally {
    clearTimeout(t);
  }
};

export default function Player() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [streamKind, setStreamKind] = useState('auto');
  const [originalStreamUrl, setOriginalStreamUrl] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

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
        const isTsUrl = /\.ts(\?|$)/i.test(url);

        let kind = isHlsUrl ? 'hls' : (isTsUrl ? 'ts' : 'auto');
        let probe = null;

        // Alguns provedores retornam HLS/TS sem extensão (ex: .php, sem .m3u8/.ts).
        // Para evitar usar o modo errado e ficar em tela preta, fazemos um probe rápido via proxy.
        if (kind === 'auto') {
          probe = await probeStreamViaProxy({ originalUrl: url });
          if (probe?.kind === 'hls' || probe?.kind === 'ts') {
            kind = probe.kind;
          }
        }

        // Usar proxy para fazer streaming (proxy segue redirects e adiciona CORS)
        // Para HLS, usar /hls para reescrever playlist e proxiar segmentos/keys.
        const proxyStreamUrl = kind === 'hls'
          ? `${IPTV_PROXY_BASE_URL}/hls?url=${encodeURIComponent(url)}`
          : `${IPTV_PROXY_BASE_URL}/stream?url=${encodeURIComponent(url)}`;

        logger.debug('player.stream.proxy_url', {
          originalUrl: url,
          proxyUrl: proxyStreamUrl,
          kind,
          isHlsUrl,
          isTsUrl,
        });
        
        setStreamUrl(proxyStreamUrl);
        setStreamKind(kind === 'auto' ? 'direct' : kind);
        setOriginalStreamUrl(url);
        setDebugInfo({
          type,
          id,
          kind,
          originalUrl: url,
          proxyUrl: proxyStreamUrl,
          probe,
        });
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

    const isHlsStream = streamUrl.includes('/hls?') || streamKind === 'hls' || /\.m3u8(\?|$)/i.test(streamUrl) || /\.m3u(\?|$)/i.test(streamUrl);
    const isTsStream = streamKind === 'ts' || /\.ts(\?|$)/i.test(streamUrl);

    // Limpar src anterior
    video.pause();
    video.removeAttribute('src');
    video.load();

    // Usar tag nativa com crossOrigin
    video.crossOrigin = 'anonymous';

    let hls;
    let mpegtsPlayer;
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

            // Best-effort autoplay when stream is ready.
            try {
              hls.on(Hls.Events.MANIFEST_PARSED, async () => {
                try {
                  await video.play();
                } catch {
                  // Autoplay might be blocked; user can press play.
                }
              });
            } catch {
              // ignore
            }

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
      if (isTsStream) {
        // MPEG-TS via MSE transmux (common for live IPTV)
        (async () => {
          try {
            const mod = await import('mpegts.js');
            const mpegts = mod?.default || mod;
            if (cancelled) return;

            if (!mpegts?.isSupported?.()) {
              setError('Seu navegador não suporta MPEG-TS');
              setLoading(false);
              return;
            }

            mpegtsPlayer = mpegts.createPlayer(
              {
                type: 'mse',
                isLive: type === 'live',
                url: streamUrl,
              },
              {
                enableWorker: true,
                lazyLoad: false,
                liveBufferLatencyChasing: true,
              }
            );

            mpegtsPlayer.attachMediaElement(video);
            mpegtsPlayer.load();

            try {
              await video.play();
            } catch {
              // Autoplay might be blocked; user can press play.
            }

            // Log player errors for diagnosis
            try {
              mpegtsPlayer.on(mpegts.Events.ERROR, (errType, errDetail, errInfo) => {
                logger.error('player.mpegts.error', { errType, errDetail, errInfo });
              });
            } catch {
              // ignore
            }
          } catch (err) {
            logger.error('player.mpegts.import_failed', { streamUrl }, err);
            setError('Falha ao inicializar player MPEG-TS');
            setLoading(false);
          }
        })();
      } else {
        video.src = streamUrl;
        // Try to start playback, but don't treat autoplay-block as fatal.
        (async () => {
          try {
            await video.play();
          } catch {
            // ignore
          }
        })();
      }
    }
    
    video.addEventListener('play', () => {
      logger.trace('player.video.play');
      setLoading(false);
    }, { once: true });
    
    const onError = (e) => {
      logger.error('player.video.error', {
        streamKind,
        streamUrl,
        code: video.error?.code,
        message: video.error?.message,
        networkState: video.networkState,
        readyState: video.readyState,
        error: e
      });
      setError(`${mediaErrorMessage(video)} (Código: ${video.error?.code ?? 'n/a'})`);
      setLoading(false);
      setDebugInfo((prev) => ({
        ...(prev || {}),
        mediaError: {
          code: video.error?.code,
          message: video.error?.message,
          networkState: video.networkState,
          readyState: video.readyState,
        },
      }));
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
      if (mpegtsPlayer) {
        try {
          mpegtsPlayer.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [streamUrl, streamKind]);

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

              {actionMsg && (
                <p className="text-gray-300 mb-3 text-sm">{actionMsg}</p>
              )}

              <div className="flex flex-wrap gap-2 justify-center mb-4">
                <button
                  onClick={async () => {
                    const ok = await copyToClipboard(streamUrl);
                    setActionMsg(ok ? 'Link do proxy copiado.' : 'Não foi possível copiar o link.');
                    setTimeout(() => setActionMsg(null), 3000);
                  }}
                  className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                >
                  Copiar link (proxy)
                </button>

                <button
                  onClick={async () => {
                    const ok = await copyToClipboard(originalStreamUrl);
                    setActionMsg(ok ? 'Link original copiado.' : 'Não foi possível copiar o link original.');
                    setTimeout(() => setActionMsg(null), 3000);
                  }}
                  className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
                >
                  Copiar link (original)
                </button>

                <button
                  onClick={() => {
                    const ok = openInVlcAndroid(originalStreamUrl || streamUrl);
                    setActionMsg(ok ? 'Tentando abrir no VLC…' : 'No Android, instale o VLC e use “Copiar link”.');
                    setTimeout(() => setActionMsg(null), 3500);
                  }}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                  Abrir no VLC
                </button>
              </div>

              <button
                onClick={() => setDebugOpen(v => !v)}
                className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors mb-3"
              >
                {debugOpen ? 'Ocultar diagnóstico' : 'Mostrar diagnóstico'}
              </button>

              {debugOpen && (
                <div className="max-w-3xl mx-auto text-left bg-dark-950/60 border border-dark-700 rounded-lg p-3 mb-4">
                  <p className="text-gray-200 text-sm mb-2">Diagnóstico</p>

                  <div className="text-xs text-gray-300 space-y-1">
                    <div><span className="text-gray-400">Tipo:</span> {debugInfo?.kind || streamKind}</div>
                    <div><span className="text-gray-400">ID:</span> {id}</div>
                    <div><span className="text-gray-400">Proxy:</span> {debugInfo?.proxyUrl || streamUrl}</div>
                    <div><span className="text-gray-400">Original:</span> {debugInfo?.originalUrl || originalStreamUrl}</div>

                    {debugInfo?.probe && (
                      <>
                        <div><span className="text-gray-400">Probe status:</span> {String(debugInfo.probe.status ?? '')}</div>
                        <div><span className="text-gray-400">Probe content-type:</span> {debugInfo.probe.contentType || ''}</div>
                        <div><span className="text-gray-400">Probe kind:</span> {debugInfo.probe.kind || ''}</div>
                        {debugInfo.probe.errorMessage && (
                          <div><span className="text-gray-400">Probe error:</span> {debugInfo.probe.errorMessage}</div>
                        )}
                        {debugInfo.probe.snippet && (
                          <div className="mt-2">
                            <div className="text-gray-400 mb-1">Primeiros bytes/texto:</div>
                            <pre className="whitespace-pre-wrap break-words bg-black/40 p-2 rounded border border-dark-800 max-h-40 overflow-auto">{debugInfo.probe.snippet}</pre>
                          </div>
                        )}
                      </>
                    )}

                    {debugInfo?.mediaError && (
                      <>
                        <div className="mt-2"><span className="text-gray-400">MediaError code:</span> {String(debugInfo.mediaError.code ?? '')}</div>
                        <div><span className="text-gray-400">MediaError message:</span> {debugInfo.mediaError.message || ''}</div>
                        <div><span className="text-gray-400">networkState:</span> {String(debugInfo.mediaError.networkState ?? '')}</div>
                        <div><span className="text-gray-400">readyState:</span> {String(debugInfo.mediaError.readyState ?? '')}</div>
                      </>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-gray-400">
                    Dica: se o erro for código 4 e o canal toca no Smarters, geralmente é codec (HEVC/AC3) ou playlist bloqueada/fora do padrão.
                  </div>
                </div>
              )}

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
