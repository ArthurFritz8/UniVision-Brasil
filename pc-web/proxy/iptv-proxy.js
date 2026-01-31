// Proxy IPTV para resolver CORS
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dns from 'dns';
import { promisify } from 'util';
import https from 'https';
import http from 'http';

// Configura DNS para usar servidores públicos do Google
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// Força IPv4
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = 3101;

// CORS totalmente aberto
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'Proxy IPTV funcionando!',
    usage: 'GET /iptv?url=http://...'
  });
});

// Headers que app de STB usa
const getHeaders = () => ({
  'User-Agent': 'VLC/3.0.0 LibVLC/3.0.0 (LIVE555 Streaming Media v2016.11.28)',
  'Accept': '*/*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'DNT': '1',
  'X-Requested-With': 'XMLHttpRequest',
});

const getProxyBaseUrl = (req) => {
  const host = req.get('host');
  const proto = req.protocol || 'http';
  return `${proto}://${host}`;
};

const isLikelyM3u8 = (url) => {
  try {
    const u = new URL(url);
    return u.pathname.endsWith('.m3u8') || u.pathname.endsWith('.m3u');
  } catch {
    return false;
  }
};

const rewriteM3u8 = ({ playlistText, playlistUrl, proxyBaseUrl }) => {
  const base = new URL(playlistUrl);

  const rewriteUri = (rawUri) => {
    const resolved = new URL(rawUri, base).toString();
    const proxied = isLikelyM3u8(resolved)
      ? `${proxyBaseUrl}/hls?url=${encodeURIComponent(resolved)}`
      : `${proxyBaseUrl}/stream?url=${encodeURIComponent(resolved)}`;
    return proxied;
  };

  return playlistText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite EXT-X-KEY URIs
      if (trimmed.startsWith('#EXT-X-KEY') && trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${rewriteUri(uri)}"`);
      }

      // Comments/directives stay as-is
      if (trimmed.startsWith('#')) return line;

      // Media segment / nested playlist
      return rewriteUri(trimmed);
    })
    .join('\n');
};

// Proxy para HLS playlists (.m3u8) com reescrita de URLs (segmentos, sub-playlists, keys)
app.get('/hls', async (req, res) => {
  try {
    const playlistUrl = req.query.url;

    if (!playlistUrl) {
      return res.status(400).json({ error: 'URL não fornecida' });
    }

    console.log('📺 HLS playlist:', playlistUrl);

    const response = await axios.get(playlistUrl, {
      headers: {
        ...getHeaders(),
        Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*',
      },
      timeout: 60000,
      maxRedirects: 5,
      responseType: 'text',
      transformResponse: (r) => r,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      console.error('❌ Erro ao buscar playlist HLS:', response.status);
      return res.status(response.status).send(response.data || 'Erro ao buscar playlist');
    }

    // URL final após redirects (quando disponível)
    const finalUrl =
      response?.request?.res?.responseUrl ||
      response?.request?._redirectable?._currentUrl ||
      playlistUrl;

    const proxyBaseUrl = getProxyBaseUrl(req);
    const rewritten = rewriteM3u8({
      playlistText: typeof response.data === 'string' ? response.data : String(response.data ?? ''),
      playlistUrl: finalUrl,
      proxyBaseUrl,
    });

    res.status(200);
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-store');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.send(rewritten);
  } catch (error) {
    console.error('❌ Erro no proxy HLS:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.options('/hls', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.status(204).end();
});

// Proxy para vídeos (streaming)
app.get('/stream', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'URL não fornecida' });
    }

    console.log('🎬 Streaming vídeo:', videoUrl);

    const range = req.headers.range;
    const headers = {
      ...getHeaders(),
      ...(range ? { Range: range } : {}),
    };

    const response = await axios.get(videoUrl, {
      headers,
      timeout: 60000,
      responseType: 'stream',
      maxRedirects: 5,
      validateStatus: () => true,
    });

    console.log('✅ Status:', response.status, 'Range:', range || 'none');

    // Propagar status (200 ou 206)
    res.status(response.status);

    // Headers de CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.set(
      'Access-Control-Expose-Headers',
      'Content-Length,Content-Range,Accept-Ranges,Content-Type'
    );

    // Propagar headers relevantes do upstream
    const passthrough = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified',
    ];
    for (const key of passthrough) {
      const v = response.headers[key];
      if (v) res.set(key, v);
    }

    // Alguns servidores não mandam accept-ranges; ajuda o player
    if (!response.headers['accept-ranges']) {
      res.set('accept-ranges', 'bytes');
    }

    // Se upstream devolver HTML/erro, isso costuma quebrar o demuxer
    const ct = response.headers['content-type'] || '';
    if (response.status >= 400 || ct.includes('text/html')) {
      console.error('❌ Upstream não retornou vídeo:', response.status, ct);
    }

    response.data.pipe(res);
    response.data.on('error', (err) => {
      console.error('❌ Erro no stream axios:', err.message);
      res.destroy(err);
    });
  } catch (error) {
    console.error('❌ Erro no proxy stream:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Preflight
app.options('/stream', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.status(204).end();
});

// Proxy para IPTV (APIs)
app.get('/iptv', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL não fornecida. Use: /iptv?url=http://...' });
    }

    console.log('🔄 Proxy requisitando:', targetUrl);

    const response = await axios.get(targetUrl, {
      headers: getHeaders(),
      timeout: 30000,
      validateStatus: () => true,
      maxRedirects: 5,
      decompress: true,
      family: 4, // Força IPv4
      responseType: 'arraybuffer',
    });

    console.log('✅ Status:', response.status);
    
    if (response.status >= 400) {
      console.error('❌ Erro da API:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `API Error: ${response.status}`,
        details: response.data 
      });
    }

    const contentType = response.headers['content-type'];
    
    if (contentType?.includes('application/json')) {
      console.log('✅ JSON recebido:', Array.isArray(JSON.parse(response.data)) ? `${JSON.parse(response.data).length} itens` : 'objeto');
      res.json(JSON.parse(response.data));
    } else if (contentType?.includes('text/plain') || targetUrl.includes('.m3u8')) {
      // M3U8 ou texto
      console.log('✅ M3U8/Texto recebido');
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Access-Control-Allow-Origin', '*');
      res.send(Buffer.from(response.data).toString());
    } else {
      console.log('✅ Binário recebido');
      res.set('Access-Control-Allow-Origin', '*');
      res.send(response.data);
    }
  } catch (error) {
    console.error('❌ Erro no proxy:', error.message);
    console.error('🔍 Código do erro:', error.code);
    console.error('🌐 URL tentada:', req.query.url);
    res.status(500).json({ 
      error: 'Falha ao conectar',
      message: error.message,
      code: error.code,
      url: req.query.url
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy IPTV rodando em http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/iptv?url=SUA_URL_API`);
  console.log(`🎬 Stream: http://localhost:${PORT}/stream?url=SUA_URL_VIDEO`);
  console.log(`📺 HLS: http://localhost:${PORT}/hls?url=SUA_URL_M3U8`);
});
