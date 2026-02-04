// Proxy IPTV para resolver CORS
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dns from 'dns';
import compression from 'compression';
import https from 'https';
import http from 'http';
import { randomUUID } from 'crypto';

// Configura DNS para usar servidores públicos do Google
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// Força IPv4
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = 3101;

app.disable('x-powered-by');

// Reutiliza conexões TCP (melhora latência e reduz overhead)
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 256 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 256 });

const upstream = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 60000,
  maxRedirects: 5,
  validateStatus: () => true,
  decompress: true,
});

const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

// Default to info to avoid noisy dev terminals; set LOG_LEVEL=debug when troubleshooting.
const defaultLevel = 'info';
const configuredLevel = String(process.env.LOG_LEVEL || defaultLevel).toLowerCase();
const currentLevel = LEVELS[configuredLevel] ?? LEVELS[defaultLevel];

const shouldLog = (levelName) => {
  const lvl = LEVELS[levelName] ?? LEVELS.info;
  return lvl <= currentLevel;
};

const redactString = (text) => {
  if (typeof text !== 'string') return text;
  let out = text;

  out = out.replace(/([?&](?:password|pass|token|access_token|auth|authorization)=)([^&]+)/gi, '$1[REDACTED]');
  out = out.replace(/([?&]username=)([^&]+)/gi, '$1[USER]');
  out = out.replace(/\/((?:live|movie|series))\/([^/]+)\/([^/]+)\//gi, '/$1/[USER]/[PASS]/');
  out = out.replace(/(https?:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, '$1[USER]:[PASS]@');

  return out;
};

const redact = (value, seen = new WeakSet()) => {
  try {
    if (typeof value === 'string') return redactString(value);
    if (value instanceof Error) return { name: value.name, message: redactString(value.message), stack: value.stack };
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) return value.map((v) => redact(v, seen));

    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/pass(word)?|token|authorization|refresh|secret/i.test(k)) out[k] = '[REDACTED]';
      else if (/url/i.test(k) && typeof v === 'string') out[k] = redactString(v);
      else out[k] = redact(v, seen);
    }
    return out;
  } catch {
    return '[Unserializable]';
  }
};

const log = (levelName, message, meta, error) => {
  if (!shouldLog(levelName)) return;

  const payload = {
    ts: new Date().toISOString(),
    level: levelName,
    msg: message,
    ...(meta !== undefined ? { meta: redact(meta) } : null),
    ...(error ? { error: redact(error) } : null),
  };

  const fn =
    levelName === 'error'
      ? console.error
      : levelName === 'warn'
        ? console.warn
        : levelName === 'debug' || levelName === 'trace'
          ? console.debug
          : console.log;

  fn('[IPTV-PROXY]', payload);
};

// CORS totalmente aberto
app.use(cors());

// Compressão apenas para respostas pequenas (JSON/m3u8). Streaming não deve ser comprimido.
app.use(
  compression({
    filter: (req, res) => {
      if (req.path === '/stream') return false;
      return compression.filter(req, res);
    },
  })
);

app.use(express.json());

// Request ID + resposta
app.use((req, res, next) => {
  req.id = randomUUID();
  res.set('x-request-id', req.id);
  next();
});

// Log básico de requests (noisy em info; deixe em debug)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log('debug', 'http', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

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

    log('debug', 'hls.playlist', { requestId: req.id, playlistUrl });

    const response = await upstream.get(playlistUrl, {
      headers: {
        ...getHeaders(),
        Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*',
      },
      responseType: 'text',
      transformResponse: (r) => r,
    });

    if (response.status >= 400) {
      log('warn', 'hls.upstream_http_error', { requestId: req.id, status: response.status, playlistUrl });
      return res
        .status(response.status)
        .send(response.data || `Erro ao buscar playlist (requestId: ${req.id})`);
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
    log('error', 'hls.proxy_failed', { requestId: req.id, playlistUrl: req.query.url }, error);
    res.status(500).json({ error: error.message, requestId: req.id });
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

    log('debug', 'stream.start', { requestId: req.id, videoUrl, range: req.headers.range });

    const range = req.headers.range;
    const headers = {
      ...getHeaders(),
      ...(range ? { Range: range } : {}),
    };

    // Streaming can last minutes/hours; don't use a global 60s axios timeout here.
    const response = await upstream.get(videoUrl, {
      headers,
      responseType: 'stream',
      timeout: 0,
    });

    log('debug', 'stream.upstream_status', { requestId: req.id, status: response.status, range: range || null });

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
      log('warn', 'stream.upstream_not_video', { requestId: req.id, status: response.status, contentType: ct, videoUrl });
    }

    let clientClosed = false;

    // Client navigated away / player stopped (normal during HLS segment churn)
    req.on('aborted', () => {
      clientClosed = true;
    });
    res.on('close', () => {
      clientClosed = true;
      try {
        response.data?.destroy?.();
      } catch {
        // ignore
      }
    });

    response.data.pipe(res);
    response.data.on('error', (err) => {
      const msg = String(err?.message || '').toLowerCase();
      const code = err?.code;
      const expected = clientClosed || msg.includes('aborted') || code === 'ECONNRESET';

      log(expected ? 'debug' : 'error', 'stream.upstream_stream_error', { requestId: req.id, videoUrl, code }, err);
      try {
        res.destroy(err);
      } catch {
        // ignore
      }
    });
  } catch (error) {
    log('error', 'stream.proxy_failed', { requestId: req.id, videoUrl: req.query.url }, error);
    res.status(500).json({ error: error.message, requestId: req.id });
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

    log('debug', 'iptv.request', { requestId: req.id, targetUrl });

    const response = await upstream.get(targetUrl, {
      headers: getHeaders(),
      family: 4, // Força IPv4
      responseType: 'arraybuffer',
    });

    log('debug', 'iptv.upstream_status', { requestId: req.id, status: response.status });
    
    if (response.status >= 400) {
      log('warn', 'iptv.upstream_http_error', { requestId: req.id, status: response.status, statusText: response.statusText, targetUrl });
      return res.status(response.status).json({ 
        error: `API Error: ${response.status}`,
        details: response.data,
        requestId: req.id,
      });
    }

    const contentType = response.headers['content-type'];
    
    if (contentType?.includes('application/json')) {
      try {
        const text = Buffer.from(response.data).toString('utf8');
        const parsed = JSON.parse(text);
        log('debug', 'iptv.json', {
          requestId: req.id,
          kind: Array.isArray(parsed) ? 'array' : typeof parsed,
          length: Array.isArray(parsed) ? parsed.length : undefined,
        });
        res.json(parsed);
      } catch (e) {
        log('warn', 'iptv.json_parse_failed', { requestId: req.id }, e);
        res.set('Access-Control-Allow-Origin', '*');
        res.send(Buffer.from(response.data).toString('utf8'));
      }
    } else if (contentType?.includes('text/plain') || targetUrl.includes('.m3u8')) {
      // M3U8 ou texto
      log('debug', 'iptv.text', { requestId: req.id, contentType });
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Access-Control-Allow-Origin', '*');
      res.send(Buffer.from(response.data).toString());
    } else {
      log('debug', 'iptv.binary', { requestId: req.id, contentType });
      res.set('Access-Control-Allow-Origin', '*');
      res.send(response.data);
    }
  } catch (error) {
    log('error', 'iptv.proxy_failed', { requestId: req.id, code: error.code, targetUrl: req.query.url }, error);
    res.status(500).json({ 
      error: 'Falha ao conectar',
      message: error.message,
      code: error.code,
      url: req.query.url,
      requestId: req.id,
    });
  }
});

app.listen(PORT, () => {
  log('info', 'startup', {
    port: PORT,
    api: `http://localhost:${PORT}/iptv?url=SUA_URL_API`,
    stream: `http://localhost:${PORT}/stream?url=SUA_URL_VIDEO`,
    hls: `http://localhost:${PORT}/hls?url=SUA_URL_M3U8`,
  });
});
