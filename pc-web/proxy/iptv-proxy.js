// Proxy IPTV para resolver CORS
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dns from 'dns';
import compression from 'compression';
import https from 'https';
import http from 'http';
import { randomUUID } from 'crypto';
import streamJsonPkg from 'stream-json';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';

const { parser } = streamJsonPkg;
const { streamArray } = streamArrayPkg;

// Configura DNS para usar servidores públicos do Google
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// Força IPv4
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = Number(process.env.PORT || 3101);

// Some IPTV providers use invalid/self-signed TLS certificates.
// Keep this OFF by default; enable only if you trust your provider.
const ALLOW_INSECURE_TLS = String(process.env.ALLOW_INSECURE_TLS || '').toLowerCase() === 'true';

// Upstream providers are often slow; allow tuning per endpoint.
// Defaults favor reliability over snappiness.
const IPTV_TIMEOUT_MS = Number(process.env.IPTV_TIMEOUT_MS || 120000);
const HLS_TIMEOUT_MS = Number(process.env.HLS_TIMEOUT_MS || 90000);

app.disable('x-powered-by');
// When hosted behind a reverse proxy (Render), honor x-forwarded-* headers
// so req.protocol is https when the public URL is https.
app.set('trust proxy', true);

// Reutiliza conexões TCP (melhora latência e reduz overhead)
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 256 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 256 });
const insecureHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 256, rejectUnauthorized: false });

const getHttpsAgent = () => (ALLOW_INSECURE_TLS ? insecureHttpsAgent : httpsAgent);

const upstream = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 60000,
  maxRedirects: 5,
  validateStatus: () => true,
  decompress: true,
});

// NOTE: cannot call log() here (it is defined below). Keep a minimal startup warning.
if (ALLOW_INSECURE_TLS) {
  console.warn('[IPTV-PROXY]', {
    ts: new Date().toISOString(),
    level: 'warn',
    msg: 'tls.insecure_enabled',
    meta: {
      note: 'ALLOW_INSECURE_TLS=true (cert validation disabled for upstream HTTPS requests)',
    },
  });
}

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

const isUpstreamNetworkError = (err) => {
  const code = err?.code || err?.cause?.code;
  const message = String(err?.message || '').toLowerCase();
  return (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    // TLS/cert issues (common with IPTV providers or image hosts)
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'ERR_SSL_WRONG_VERSION_NUMBER' ||
    code === 'EPROTO' ||
    message.includes('certificate') ||
    message.includes('self signed')
  );
};

const isTimeoutError = (err) => {
  const code = err?.code || err?.cause?.code;
  return code === 'ECONNABORTED' || code === 'ETIMEDOUT';
};

const IPTV_LIMIT_MAX = Number(process.env.IPTV_LIMIT_MAX || 300);

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseJsonArrayLimitedFromStream = async ({ stream, limit, requestId }) => {
  const max = Math.max(1, Math.min(Number(limit) || 1, IPTV_LIMIT_MAX));
  return await new Promise((resolve, reject) => {
    let done = false;
    const items = [];

    const p = parser();
    const s = streamArray();

    const cleanup = () => {
      try {
        stream?.unpipe?.(p);
      } catch {
        // ignore
      }
      try {
        p?.destroy?.();
      } catch {
        // ignore
      }
      try {
        s?.destroy?.();
      } catch {
        // ignore
      }
    };

    const finishOk = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve(items);
    };

    const finishErr = (err) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err);
    };

    s.on('data', ({ value }) => {
      items.push(value);
      if (items.length >= max) {
        // Stop downloading the rest of the huge payload.
        try {
          stream?.destroy?.();
        } catch {
          // ignore
        }
        finishOk();
      }
    });
    s.on('end', finishOk);
    s.on('error', (err) => {
      log('warn', 'iptv.stream_parse_failed', { requestId, limit: max }, err);
      finishErr(err);
    });
    p.on('error', (err) => {
      log('warn', 'iptv.stream_parse_failed', { requestId, limit: max }, err);
      finishErr(err);
    });
    stream.on('error', (err) => {
      // If we intentionally destroyed the stream after reaching the limit, ignore.
      if (done) return;
      finishErr(err);
    });

    stream.pipe(p).pipe(s);
  });
};

const parseJsonArrayFilteredFromStream = async ({ stream, limit, requestId, query }) => {
  const q = normalizeText(query);
  const max = Math.max(1, Math.min(Number(limit) || 1, IPTV_LIMIT_MAX));

  return await new Promise((resolve, reject) => {
    let done = false;
    const items = [];

    const p = parser();
    const s = streamArray();

    const cleanup = () => {
      try {
        stream?.unpipe?.(p);
      } catch {
        // ignore
      }
      try {
        p?.destroy?.();
      } catch {
        // ignore
      }
      try {
        s?.destroy?.();
      } catch {
        // ignore
      }
    };

    const finishOk = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve(items);
    };

    const finishErr = (err) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err);
    };

    const matches = (value) => {
      if (!q) return true;
      const name =
        value?.name ??
        value?.title ??
        value?.stream_display_name ??
        value?.stream_name ??
        value?.tv_name ??
        '';
      return normalizeText(name).includes(q);
    };

    s.on('data', ({ value }) => {
      if (matches(value)) {
        items.push(value);
        if (items.length >= max) {
          try {
            stream?.destroy?.();
          } catch {
            // ignore
          }
          finishOk();
        }
      }
    });
    s.on('end', finishOk);
    s.on('error', (err) => {
      log('warn', 'iptv.stream_parse_failed', { requestId, limit: max, mode: 'filter' }, err);
      finishErr(err);
    });
    p.on('error', (err) => {
      log('warn', 'iptv.stream_parse_failed', { requestId, limit: max, mode: 'filter' }, err);
      finishErr(err);
    });
    stream.on('error', (err) => {
      if (done) return;
      finishErr(err);
    });

    stream.pipe(p).pipe(s);
  });
};

// --- Simple TTL + LRU cache for metadata endpoints (JSON) ---
// Helps a lot when navigating between pages or reloading the app.
const CACHE_MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 60);
const CACHE_MAX_BYTES = Number(process.env.CACHE_MAX_BYTES || 64 * 1024 * 1024); // 64MB
const CACHE_MAX_ENTRY_BYTES = Number(process.env.CACHE_MAX_ENTRY_BYTES || 20 * 1024 * 1024); // 20MB per response
// If upstream is slow/down, serve stale cached data for a while instead of failing hard.
const CACHE_STALE_IF_ERROR_MS = Number(process.env.CACHE_STALE_IF_ERROR_MS || 12 * 60 * 60 * 1000); // 12h

const cacheStore = new Map();
let cacheBytes = 0;

// Dedupe concurrent upstream calls for the same key (prevents thundering herd).
const inflightByKey = new Map();

const cacheDel = (key) => {
  const existing = cacheStore.get(key);
  if (existing) {
    cacheBytes -= existing.size || 0;
    cacheStore.delete(key);
  }
};

const cacheGetFresh = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    return null;
  }
  // Refresh LRU
  cacheStore.delete(key);
  cacheStore.set(key, entry);
  return entry;
};

const cacheGetStale = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  const staleUntil = entry.staleUntil ?? entry.expiresAt;
  if (staleUntil <= now) {
    cacheDel(key);
    return null;
  }

  // Refresh LRU
  cacheStore.delete(key);
  cacheStore.set(key, entry);
  return entry;
};

const cacheSet = (key, body, ttlMs) => {
  try {
    const size = Buffer.byteLength(body || '', 'utf8');
    if (!size || size > CACHE_MAX_ENTRY_BYTES) return;

    cacheDel(key);
    const expiresAt = Date.now() + ttlMs;
    const staleUntil = expiresAt + CACHE_STALE_IF_ERROR_MS;
    cacheStore.set(key, { body, expiresAt, staleUntil, size });
    cacheBytes += size;

    // Evict LRU
    while (cacheStore.size > CACHE_MAX_ENTRIES || cacheBytes > CACHE_MAX_BYTES) {
      const oldestKey = cacheStore.keys().next().value;
      if (!oldestKey) break;
      cacheDel(oldestKey);
    }
  } catch {
    // ignore cache failures
  }
};

const withInflight = async (key, fn) => {
  if (!key) return fn();
  const existing = inflightByKey.get(key);
  if (existing) return existing;

  const p = Promise.resolve()
    .then(fn)
    .finally(() => {
      // Only delete if it's still the same promise.
      if (inflightByKey.get(key) === p) inflightByKey.delete(key);
    });

  inflightByKey.set(key, p);
  return p;
};

const getXtreamCacheKey = (targetUrl) => {
  try {
    const u = new URL(targetUrl);
    const action = u.searchParams.get('action');
    if (!action) return null;

    const categoryId = u.searchParams.get('category_id') || '';
    const seriesId = u.searchParams.get('series_id') || '';
    const vodId = u.searchParams.get('vod_id') || '';
    const streamId = u.searchParams.get('stream_id') || '';

    // Key only on params that affect payload; ignore username/password in the URL.
    return `xtream:${action}:cat=${categoryId}:series=${seriesId}:vod=${vodId}:stream=${streamId}`;
  } catch {
    return null;
  }
};

const getXtreamTtlMs = (targetUrl) => {
  try {
    const u = new URL(targetUrl);
    const action = u.searchParams.get('action') || '';
    if (action.includes('categories')) return 60 * 60 * 1000; // 1h
    if (action === 'get_series_info') return 10 * 60 * 1000;
    if (action.endsWith('_info')) return 10 * 60 * 1000;
    // These are heavy; cache longer for speed.
    if (action === 'get_live_streams' || action === 'get_vod_streams' || action === 'get_series') return 30 * 60 * 1000; // 30m
    return 0;
  } catch {
    return 0;
  }
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

const IMG_CACHE_MAX_AGE = Number(process.env.IMG_CACHE_MAX_AGE || 21600); // 6h

// Proxy para imagens (logos de canais, posters, etc.)
app.get('/img', async (req, res) => {
  const imageUrl = req.query.url;

  try {
    if (!imageUrl) {
      return res.status(400).json({ error: 'URL não fornecida' });
    }

    let u;
    try {
      u = new URL(String(imageUrl));
    } catch {
      return res.status(400).json({ error: 'URL inválida' });
    }

    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return res.status(400).json({ error: 'Protocolo inválido' });
    }

    log('debug', 'img.fetch', { requestId: req.id, imageUrl });

    const response = await upstream.get(u.toString(), {
      headers: {
        ...getHeaders(),
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      httpsAgent: getHttpsAgent(),
      responseType: 'stream',
      timeout: 30000,
    });

    if (response.status >= 400) {
      log('warn', 'img.upstream_http_error', { requestId: req.id, status: response.status, imageUrl });
      return res.status(response.status).end();
    }

    res.status(200);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Cache-Control', `public, max-age=${IMG_CACHE_MAX_AGE}`);

    const passthrough = ['content-type', 'content-length', 'etag', 'last-modified'];
    for (const key of passthrough) {
      const v = response.headers[key];
      if (v) res.set(key, v);
    }

    response.data.on('error', (err) => {
      log('debug', 'img.upstream_stream_error', { requestId: req.id, imageUrl, code: err?.code }, err);
      try {
        res.destroy(err);
      } catch {
        // ignore
      }
    });

    response.data.pipe(res);
  } catch (error) {
    const networkish = isUpstreamNetworkError(error);
    const code = error?.code;

    log(networkish ? 'warn' : 'error', 'img.proxy_failed', { requestId: req.id, imageUrl, code }, error);
    res.status(networkish ? 504 : 500).end();
  }
});

app.options('/img', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
});

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
  const playlistUrl = req.query.url;

  try {
    if (!playlistUrl) {
      return res.status(400).json({ error: 'URL não fornecida' });
    }

    let parsed;
    try {
      parsed = new URL(String(playlistUrl));
    } catch {
      return res.status(400).json({ error: 'URL inválida' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Protocolo inválido' });
    }

    const buildCandidateUrls = (rawUrl) => {
      try {
        const u = new URL(String(rawUrl));

        // Try the provided URL first. Many IPTV providers are http-only;
        // preferring https can cause long timeouts and never fall back.
        const urls = [u.toString()];

        if (u.protocol === 'http:') {
          const httpsUrl = new URL(u.toString());
          httpsUrl.protocol = 'https:';
          urls.push(httpsUrl.toString());
        } else if (u.protocol === 'https:') {
          const httpUrl = new URL(u.toString());
          httpUrl.protocol = 'http:';
          urls.push(httpUrl.toString());
        }

        return urls;
      } catch {
        return [String(rawUrl)];
      }
    };

    const fetchOnce = (url) =>
      upstream.get(url, {
        headers: {
          ...getHeaders(),
          Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*',
        },
        httpsAgent: getHttpsAgent(),
        responseType: 'arraybuffer',
        timeout: HLS_TIMEOUT_MS,
      });

    const candidates = buildCandidateUrls(parsed.toString());
    let response = null;
    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
      const candidateUrl = candidates[i];
      try {
        if (i > 0) {
          log('warn', 'hls.retry_candidate', { requestId: req.id, from: playlistUrl, to: candidateUrl });
        }

        const r = await fetchOnce(candidateUrl);
        response = r;

        if (r.status < 400) break;

        const retryableStatus = r.status === 500 || r.status === 502 || r.status === 503 || r.status === 504 || r.status === 403;
        if (!retryableStatus || i === candidates.length - 1) break;
      } catch (err) {
        lastError = err;
        const networkish = isUpstreamNetworkError(err);
        // If we already waited a full timeout, don't try another protocol (reduces long hangs).
        if (isTimeoutError(err) || !networkish || i === candidates.length - 1) throw err;
      }
    }

    if (!response) {
      throw lastError || new Error('No upstream response');
    }

    if (response.status >= 400) {
      log('warn', 'hls.upstream_http_error', { requestId: req.id, status: response.status, playlistUrl });
      res.status(response.status);
      res.set('Access-Control-Allow-Origin', '*');
      return res.send(`Erro ao buscar playlist (status ${response.status}, requestId: ${req.id})`);
    }

    // URL final após redirects (quando disponível)
    const finalUrl =
      response?.request?.res?.responseUrl ||
      response?.request?._redirectable?._currentUrl ||
      response?.config?.url ||
      playlistUrl;

    const proxyBaseUrl = getProxyBaseUrl(req);
    const playlistText = Buffer.from(response.data).toString('utf8');
    const rewritten = rewriteM3u8({
      playlistText,
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
    const networkish = isUpstreamNetworkError(error);
    const code = error?.code;

    if (networkish) {
      log(
        'warn',
        'hls.upstream_unreachable',
        { requestId: req.id, code, playlistUrl },
        { name: error?.name, message: error?.message, code }
      );
      return res.status(504).json({
        error: 'Upstream indisponível',
        message: error?.message,
        code,
        url: playlistUrl,
        requestId: req.id,
      });
    }

    log('error', 'hls.proxy_failed', { requestId: req.id, playlistUrl }, error);
    res.status(500).json({ error: error.message, requestId: req.id });
  }
});

app.options('/hls', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.status(204).end();
});

// --- Xtream helpers (series) ---
const parseXtreamBase = (rawBase) => {
  let u;
  try {
    u = new URL(String(rawBase));
  } catch {
    return null;
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const username = u.searchParams.get('username');
  const password = u.searchParams.get('password');

  // Base for stream URLs (remove /player_api.php)
  const pathname = String(u.pathname || '');
  const apiPath = pathname.endsWith('/player_api.php') ? pathname.slice(0, -'/player_api.php'.length) : pathname;
  const apiBase = `${u.origin}${apiPath}`.replace(/\/$/, '');

  return { url: u, username, password, apiBase };
};

const normalizeSeasonsFromSeriesInfo = (payload) => {
  const seasonsRaw = Array.isArray(payload?.seasons) ? payload.seasons : [];
  return seasonsRaw
    .map((s) => ({
      season_number: Number(s?.season_number ?? s?.season ?? s?.number ?? 0),
      episode_count: Number(s?.episode_count ?? s?.episodes ?? 0),
    }))
    .filter((s) => Number.isFinite(s.season_number) && s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);
};

const fetchXtreamJsonCached = async ({ targetUrl, requestId }) => {
  const cacheKey = getXtreamCacheKey(targetUrl);
  const ttlMs = cacheKey ? getXtreamTtlMs(targetUrl) : 0;

  if (cacheKey && ttlMs > 0) {
    const hit = cacheGetFresh(cacheKey);
    if (hit) {
      try {
        return { json: JSON.parse(hit.body), cache: 'HIT' };
      } catch {
        // fall through
      }
    }
  }

  const doFetch = async () => {
    const response = await upstream.get(targetUrl, {
      headers: getHeaders(),
      family: 4,
      httpsAgent: getHttpsAgent(),
      responseType: 'arraybuffer',
      timeout: IPTV_TIMEOUT_MS,
    });

    if (response.status >= 400) {
      const err = new Error(`Upstream HTTP ${response.status}`);
      err.statusCode = response.status;
      err.upstreamStatus = response.status;
      err.requestId = requestId;
      throw err;
    }

    const text = Buffer.from(response.data).toString('utf8');
    const json = JSON.parse(text);

    if (cacheKey && ttlMs > 0) {
      cacheSet(cacheKey, JSON.stringify(json), ttlMs);
    }

    return { json, cache: cacheKey && ttlMs > 0 ? 'MISS' : 'BYPASS' };
  };

  try {
    return await withInflight(cacheKey, doFetch);
  } catch (err) {
    // Serve stale on network-ish errors (timeout, DNS, TLS) if available.
    const stale = cacheKey ? cacheGetStale(cacheKey) : null;
    if (stale && isUpstreamNetworkError(err)) {
      try {
        return { json: JSON.parse(stale.body), cache: 'STALE' };
      } catch {
        // ignore
      }
    }
    throw err;
  }
};

// Returns only seasons + info (no big episodes payload)
app.get('/series/info', async (req, res) => {
  const base = req.query.base;
  const seriesId = req.query.series_id;

  try {
    if (!base) return res.status(400).json({ error: 'Parâmetro base ausente' });
    if (!seriesId) return res.status(400).json({ error: 'Parâmetro series_id ausente' });

    const parsed = parseXtreamBase(base);
    if (!parsed) return res.status(400).json({ error: 'Base inválida' });

    const u = new URL(parsed.url.toString());
    u.searchParams.set('action', 'get_series_info');
    u.searchParams.set('series_id', String(seriesId));
    const targetUrl = u.toString();

    log('debug', 'series.info', { requestId: req.id, seriesId, targetUrl });
    const { json, cache } = await fetchXtreamJsonCached({ targetUrl, requestId: req.id });

    const seasons = normalizeSeasonsFromSeriesInfo(json);
    res.status(200);
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('x-cache', cache);
    res.json({ seasons, info: json?.info || null });
  } catch (error) {
    const networkish = isUpstreamNetworkError(error);
    const status = networkish ? 504 : error?.statusCode || 500;
    log(status >= 500 ? (networkish ? 'warn' : 'error') : 'warn', 'series.info_failed', { requestId: req.id, seriesId, base }, error);
    res.status(status).json({
      error: networkish ? 'Upstream indisponível' : 'Falha ao buscar série',
      message: error?.message,
      requestId: req.id,
    });
  }
});

// Returns episodes for one season, already mapped for the client
app.get('/series/episodes', async (req, res) => {
  const base = req.query.base;
  const seriesId = req.query.series_id;
  const seasonNumber = Number(req.query.season_number ?? req.query.season ?? 1);

  try {
    if (!base) return res.status(400).json({ error: 'Parâmetro base ausente' });
    if (!seriesId) return res.status(400).json({ error: 'Parâmetro series_id ausente' });
    if (!Number.isFinite(seasonNumber) || seasonNumber <= 0) {
      return res.status(400).json({ error: 'Parâmetro season_number inválido' });
    }

    const parsed = parseXtreamBase(base);
    if (!parsed) return res.status(400).json({ error: 'Base inválida' });

    const u = new URL(parsed.url.toString());
    u.searchParams.set('action', 'get_series_info');
    u.searchParams.set('series_id', String(seriesId));
    const targetUrl = u.toString();

    log('debug', 'series.episodes', { requestId: req.id, seriesId, seasonNumber, targetUrl });
    const { json, cache } = await fetchXtreamJsonCached({ targetUrl, requestId: req.id });

    const rawEpisodes = json?.episodes;

    const pickEpisodesForSeason = (episodesValue, seasonNo) => {
      if (!episodesValue) return [];

      // Some providers return an array of episodes (with a season field).
      if (Array.isArray(episodesValue)) {
        const withSeason = episodesValue.filter((ep) => {
          const s = Number(ep?.season ?? ep?.season_number ?? ep?.season_num ?? ep?.info?.season ?? NaN);
          return Number.isFinite(s) ? s === seasonNo : false;
        });
        return withSeason.length > 0 ? withSeason : episodesValue;
      }

      // Most providers return an object keyed by season number => episode list
      if (typeof episodesValue === 'object') {
        const obj = episodesValue;
        const keyCandidates = [String(seasonNo), String(seasonNo).padStart(2, '0')];

        for (const key of keyCandidates) {
          const v = obj[key];
          if (Array.isArray(v)) return v;
          if (v && typeof v === 'object' && Array.isArray(v.episodes)) return v.episodes;
        }

        // Try matching non-numeric keys like "Season 1".
        for (const [k, v] of Object.entries(obj)) {
          const digits = String(k).match(/\d+/g);
          const n = digits ? Number(digits.join('')) : NaN;
          if (n === seasonNo) {
            if (Array.isArray(v)) return v;
            if (v && typeof v === 'object' && Array.isArray(v.episodes)) return v.episodes;
          }
        }

        // Fallback: flatten any arrays and filter by season if possible.
        const flattened = [];
        for (const v of Object.values(obj)) {
          if (Array.isArray(v)) flattened.push(...v);
          else if (v && typeof v === 'object' && Array.isArray(v.episodes)) flattened.push(...v.episodes);
        }
        const filtered = flattened.filter((ep) => {
          const s = Number(ep?.season ?? ep?.season_number ?? ep?.season_num ?? ep?.info?.season ?? NaN);
          return Number.isFinite(s) ? s === seasonNo : false;
        });
        return filtered.length > 0 ? filtered : flattened;
      }

      return [];
    };

    const rawList = pickEpisodesForSeason(rawEpisodes, seasonNumber);

    const episodes = rawList
      .map((ep) => {
        const episodeId = ep?.id ?? ep?.episode_id ?? ep?.stream_id;
        const ext = ep?.container_extension || 'mp4';
        const direct = ep?.direct_source;

        const streamUrl =
          direct ||
          (parsed.apiBase && parsed.username && parsed.password && episodeId
            ? `${parsed.apiBase}/series/${parsed.username}/${parsed.password}/${episodeId}.${ext}`
            : null);

        return {
          id: episodeId,
          episode_number: Number(ep?.episode_num ?? ep?.episode_number ?? ep?.num ?? 0),
          season_number: Number(ep?.season ?? seasonNumber),
          title: ep?.title || (ep?.episode_num ? `Episódio ${ep.episode_num}` : 'Episódio'),
          plot: ep?.info?.plot ?? null,
          streamUrl,
        };
      })
      .filter((e) => e.streamUrl);

    res.status(200);
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('x-cache', cache);
    res.json({ episodes });
  } catch (error) {
    const networkish = isUpstreamNetworkError(error);
    const status = networkish ? 504 : error?.statusCode || 500;
    log(status >= 500 ? (networkish ? 'warn' : 'error') : 'warn', 'series.episodes_failed', { requestId: req.id, seriesId, seasonNumber, base }, error);
    res.status(status).json({
      error: networkish ? 'Upstream indisponível' : 'Falha ao buscar episódios',
      message: error?.message,
      requestId: req.id,
    });
  }
});

app.options('/series/info', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
});

app.options('/series/episodes', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
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

    const buildCandidateUrls = (rawUrl) => {
      try {
        const u = new URL(String(rawUrl));
        const urls = [u.toString()];

        if (u.protocol === 'http:') {
          const httpsUrl = new URL(u.toString());
          httpsUrl.protocol = 'https:';
          urls.push(httpsUrl.toString());
        } else if (u.protocol === 'https:') {
          const httpUrl = new URL(u.toString());
          httpUrl.protocol = 'http:';
          urls.push(httpUrl.toString());
        }

        return urls;
      } catch {
        return [String(rawUrl)];
      }
    };

    const fetchOnce = (url) =>
      upstream.get(url, {
        headers,
        httpsAgent: getHttpsAgent(),
        responseType: 'stream',
        // Streaming can last minutes/hours; don't use a global timeout here.
        timeout: 0,
      });

    const candidates = buildCandidateUrls(videoUrl);
    let response = null;
    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
      const candidateUrl = candidates[i];
      try {
        if (i > 0) {
          log('warn', 'stream.retry_candidate', { requestId: req.id, from: videoUrl, to: candidateUrl });
        }

        const r = await fetchOnce(candidateUrl);
        response = r;

        if (r.status < 400) break;

        const retryableStatus = r.status === 500 || r.status === 502 || r.status === 503 || r.status === 504 || r.status === 403;
        if (!retryableStatus || i === candidates.length - 1) break;

        // Discard upstream body before retrying
        try {
          r.data?.destroy?.();
        } catch {
          // ignore
        }
      } catch (err) {
        lastError = err;
        const networkish = isUpstreamNetworkError(err);
        if (!networkish || i === candidates.length - 1) throw err;
      }
    }

    if (!response) {
      throw lastError || new Error('No upstream response');
    }

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

    const requestedLimitRaw = req.query.limit;
    const requestedLimit = Number(requestedLimitRaw);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, IPTV_LIMIT_MAX) : null;

    const qRaw = req.query.q;
    const q = typeof qRaw === 'string' ? qRaw : Array.isArray(qRaw) ? qRaw[0] : '';
    const qNorm = normalizeText(q);
    const shouldFilter = Boolean(qNorm && qNorm.length >= 2);

    let action = null;
    try {
      action = new URL(String(targetUrl)).searchParams.get('action');
    } catch {
      action = null;
    }

    const canTruncate = Boolean(
      limit && (action === 'get_live_streams' || action === 'get_vod_streams' || action === 'get_series')
    );

    const canFilter = Boolean(canTruncate && shouldFilter);

    log('debug', 'iptv.request', { requestId: req.id, targetUrl, action, limit, canTruncate, canFilter, q: shouldFilter ? qNorm : undefined });

    const baseCacheKey = getXtreamCacheKey(targetUrl);
    const cacheKey = baseCacheKey && canTruncate
      ? `${baseCacheKey}:limit=${limit}${canFilter ? `:q=${encodeURIComponent(qNorm).slice(0, 180)}` : ''}`
      : baseCacheKey;
    const ttlMs = cacheKey ? getXtreamTtlMs(targetUrl) : 0;

    if (cacheKey && ttlMs > 0) {
      const hit = cacheGetFresh(cacheKey);
      if (hit) {
        res.status(200);
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('x-cache', 'HIT');
        return res.send(hit.body);
      }
    }

    const staleEntry = cacheKey ? cacheGetStale(cacheKey) : null;

    const buildCandidateUrls = (rawUrl) => {
      try {
        const u = new URL(String(rawUrl));

        // Try the provided URL first. Some IPTV providers are http-only;
        // preferring https can cause long timeouts and never fall back.
        const urls = [u.toString()];

        if (u.protocol === 'http:') {
          const httpsUrl = new URL(u.toString());
          httpsUrl.protocol = 'https:';
          urls.push(httpsUrl.toString());
        } else if (u.protocol === 'https:') {
          const httpUrl = new URL(u.toString());
          httpUrl.protocol = 'http:';
          urls.push(httpUrl.toString());
        }

        return urls;
      } catch {
        return [String(rawUrl)];
      }
    };

    const fetchOnce = (url) =>
      upstream.get(url, {
        headers: getHeaders(),
        family: 4, // Força IPv4
        httpsAgent: getHttpsAgent(),
        responseType: canTruncate ? 'stream' : 'arraybuffer',
        timeout: IPTV_TIMEOUT_MS,
      });

    const doFetch = async () => {
      const candidates = buildCandidateUrls(targetUrl);
      let response = null;
      let lastError = null;

      for (let i = 0; i < candidates.length; i++) {
        const candidateUrl = candidates[i];
        try {
          if (i > 0) {
            log('warn', 'iptv.retry_candidate', {
              requestId: req.id,
              from: targetUrl,
              to: candidateUrl,
            });
          }

          const r = await fetchOnce(candidateUrl);
          response = r;

          if (r.status < 400) break;

          // If upstream is refusing or gatewaying (common on http), try next candidate.
          const retryableStatus = r.status === 500 || r.status === 502 || r.status === 503 || r.status === 504 || r.status === 403;
          if (!retryableStatus || i === candidates.length - 1) break;

          // Discard upstream body before retrying
          try {
            r.data?.destroy?.();
          } catch {
            // ignore
          }
        } catch (err) {
          lastError = err;
          const networkish = isUpstreamNetworkError(err);
          // If we already waited a full timeout, don't try another protocol (reduces long hangs).
          if (isTimeoutError(err) || !networkish || i === candidates.length - 1) throw err;
        }
      }

      if (!response) {
        throw lastError || new Error('No upstream response');
      }
      return response;
    };

    let response;
    try {
      response = await withInflight(cacheKey, doFetch);
    } catch (err) {
      // Serve stale cache on network-ish errors.
      if (staleEntry && isUpstreamNetworkError(err)) {
        res.status(200);
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('x-cache', 'STALE');
        return res.send(staleEntry.body);
      }
      throw err;
    }

    log('debug', 'iptv.upstream_status', { requestId: req.id, status: response.status });
    
    if (response.status >= 400) {
      log('warn', 'iptv.upstream_http_error', { requestId: req.id, status: response.status, statusText: response.statusText, targetUrl });

      // If upstream is failing and we have stale cache, prefer returning stale over an empty UI.
      const isRetryableHttp = response.status >= 500 || response.status === 502 || response.status === 503 || response.status === 504;
      if (staleEntry && isRetryableHttp) {
        res.status(200);
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('x-cache', 'STALE');
        return res.send(staleEntry.body);
      }

      return res.status(response.status).json({ 
        error: `API Error: ${response.status}`,
        details: response.data,
        requestId: req.id,
      });
    }

    const contentType = response.headers['content-type'];
    
    if (contentType?.includes('application/json')) {
      try {
        // For huge lists, stream-parse and truncate early.
        if (canTruncate && response.data && typeof response.data.pipe === 'function') {
          const items = canFilter
            ? await parseJsonArrayFilteredFromStream({ stream: response.data, limit, requestId: req.id, query: qNorm })
            : await parseJsonArrayLimitedFromStream({ stream: response.data, limit, requestId: req.id });
          const body = JSON.stringify(items);

          if (cacheKey && ttlMs > 0) {
            cacheSet(cacheKey, body, ttlMs);
          }

          res.status(200);
          res.set('Content-Type', 'application/json; charset=utf-8');
          res.set('Access-Control-Allow-Origin', '*');
          res.set('x-truncated', 'true');
          res.set('x-limit', String(limit));
          if (canFilter) res.set('x-filtered', 'true');
          if (cacheKey && ttlMs > 0) res.set('x-cache', staleEntry ? 'REFRESH' : 'MISS');
          return res.send(body);
        }

        const text = Buffer.from(response.data).toString('utf8');
        const parsed = JSON.parse(text);
        log('debug', 'iptv.json', {
          requestId: req.id,
          kind: Array.isArray(parsed) ? 'array' : typeof parsed,
          length: Array.isArray(parsed) ? parsed.length : undefined,
        });
        const body = JSON.stringify(parsed);

        if (cacheKey && ttlMs > 0) {
          cacheSet(cacheKey, body, ttlMs);
        }

        res.status(200);
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Access-Control-Allow-Origin', '*');
        if (cacheKey && ttlMs > 0) res.set('x-cache', 'MISS');
        res.send(body);
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
    const networkish = isUpstreamNetworkError(error);
    const code = error?.code;

    // Provider/network instability is common; log as warn and avoid stack spam.
    if (networkish) {
      log(
        'warn',
        'iptv.upstream_unreachable',
        { requestId: req.id, code, targetUrl: req.query.url },
        { name: error?.name, message: error?.message, code }
      );
      return res.status(504).json({
        error: 'Upstream indisponível',
        message: error?.message,
        code,
        url: req.query.url,
        requestId: req.id,
      });
    }

    log('error', 'iptv.proxy_failed', { requestId: req.id, code, targetUrl: req.query.url }, error);
    res.status(500).json({
      error: 'Falha ao conectar',
      message: error?.message,
      code,
      url: req.query.url,
      requestId: req.id,
    });
  }
});

app.listen(PORT, () => {
  log('info', 'startup', {
    port: PORT,
    api: `http://localhost:${PORT}/iptv?url=SUA_URL_API`,
    img: `http://localhost:${PORT}/img?url=SUA_URL_IMAGEM`,
    stream: `http://localhost:${PORT}/stream?url=SUA_URL_VIDEO`,
    hls: `http://localhost:${PORT}/hls?url=SUA_URL_M3U8`,
    seriesInfo: `http://localhost:${PORT}/series/info?base=SUA_PLAYER_API_BASE&series_id=123`,
    seriesEpisodes: `http://localhost:${PORT}/series/episodes?base=SUA_PLAYER_API_BASE&series_id=123&season_number=1`,
  });
});
