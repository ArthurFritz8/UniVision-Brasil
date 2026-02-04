import Channel from '../models/Channel.model.js';
import Content from '../models/Content.model.js';
import { logger } from '../config/logger.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const STREAM_TOKEN_SECRET = process.env.STREAM_TOKEN_SECRET || process.env.JWT_SECRET;
const STREAM_TOKEN_EXPIRE = process.env.STREAM_TOKEN_EXPIRE || '10m';
const STREAM_TOKEN_BIND_IP = String(process.env.STREAM_TOKEN_BIND_IP || '').toLowerCase() === 'true';

// Axios `timeout` here is a socket inactivity timeout (not total stream duration).
// This protects the server from hanging upstream connections when the origin is slow/unresponsive.
const STREAM_UPSTREAM_INACTIVITY_TIMEOUT_MS = Number(process.env.STREAM_UPSTREAM_INACTIVITY_TIMEOUT_MS || 20000);
const STREAM_UPSTREAM_PLAYLIST_TIMEOUT_MS = Number(process.env.STREAM_UPSTREAM_PLAYLIST_TIMEOUT_MS || 30000);
const STREAM_UPSTREAM_MAX_REDIRECTS = Number(process.env.STREAM_UPSTREAM_MAX_REDIRECTS || 5);

const isClientAbortCancel = (err) => {
  const code = err?.code;
  const name = err?.name;
  return code === 'ERR_CANCELED' || name === 'CanceledError' || name === 'AbortError';
};

const getClientIp = (req) => req.ip;

const getAllowedUpstreamHosts = (primaryHost) => {
  const envList = String(process.env.STREAM_UPSTREAM_HOST_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set(envList);
  if (primaryHost) out.add(String(primaryHost).toLowerCase());
  return out;
};

const isPrivateHostname = (hostname) => {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost');
};

const isPrivateIpLiteral = (hostname) => {
  const h = String(hostname || '').trim();
  const m4 = h.match(/^\d{1,3}(?:\.\d{1,3}){3}$/);
  if (!m4) return false;
  const parts = h.split('.').map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
};

const assertUpstreamUrlAllowed = (rawUrl, allowedHosts) => {
  let u;
  try {
    u = new URL(String(rawUrl));
  } catch {
    const err = new Error('URL inválida');
    err.statusCode = 400;
    throw err;
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    const err = new Error('Protocolo não permitido');
    err.statusCode = 400;
    throw err;
  }

  const hostname = u.hostname;
  const allowPrivate = String(process.env.STREAM_ALLOW_PRIVATE_UPSTREAM || '').toLowerCase() === 'true';
  if (!allowPrivate && (isPrivateHostname(hostname) || isPrivateIpLiteral(hostname))) {
    const err = new Error('Destino upstream não permitido');
    err.statusCode = 403;
    throw err;
  }

  if (allowedHosts && allowedHosts.size > 0) {
    const hn = String(hostname).toLowerCase();
    if (!allowedHosts.has(hn)) {
      const err = new Error('Host upstream não permitido');
      err.statusCode = 403;
      throw err;
    }
  }

  return u;
};

const signStreamToken = ({ type, id, user, upstreamHost, clientIp }) => {
  if (!STREAM_TOKEN_SECRET) {
    throw new Error('STREAM_TOKEN_SECRET/JWT_SECRET não configurado');
  }

  return jwt.sign(
    {
      type,
      id,
      uid: user?.id,
      role: user?.role,
      upHost: upstreamHost,
      ...(STREAM_TOKEN_BIND_IP ? { ip: clientIp } : null),
    },
    STREAM_TOKEN_SECRET,
    { expiresIn: STREAM_TOKEN_EXPIRE }
  );
};

const verifyStreamToken = (token) => {
  if (!STREAM_TOKEN_SECRET) {
    const err = new Error('STREAM_TOKEN_SECRET/JWT_SECRET não configurado');
    err.statusCode = 500;
    throw err;
  }

  try {
    return jwt.verify(String(token), STREAM_TOKEN_SECRET);
  } catch {
    const err = new Error('Token de stream inválido ou expirado');
    err.statusCode = 401;
    throw err;
  }
};

const getAxiosFinalUrl = (response, fallback) => {
  return (
    response?.request?.res?.responseUrl ||
    response?.request?._redirectable?._currentUrl ||
    fallback
  );
};

const rewriteM3u8 = ({ playlistText, playlistUrl, proxyBase, token }) => {
  let base;
  try {
    base = new URL(String(playlistUrl));
  } catch {
    base = null;
  }

  const lines = String(playlistText || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }

    if (trimmed.startsWith('#EXT-X-KEY') && trimmed.includes('URI="')) {
      const replaced = trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
        let resolved = uri;
        try {
          resolved = base ? new URL(uri, base).toString() : uri;
        } catch {
          // ignore
        }
        const fetchUrl = `${proxyBase}/api/stream/fetch?token=${encodeURIComponent(token)}&url=${encodeURIComponent(resolved)}`;
        return `URI="${fetchUrl}"`;
      });
      out.push(replaced);
      continue;
    }

    if (trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }

    let resolved = trimmed;
    try {
      resolved = base ? new URL(trimmed, base).toString() : trimmed;
    } catch {
      // keep original
    }

    const fetchUrl = `${proxyBase}/api/stream/fetch?token=${encodeURIComponent(token)}&url=${encodeURIComponent(resolved)}`;
    out.push(fetchUrl);
  }

  return out.join('\n');
};

export const getStreamUrl = async (req, res, next) => {
  try {
    const { type, id } = req.params;

    let item;
    if (type === 'channel') {
      item = await Channel.findById(id);
    } else if (type === 'content') {
      item = await Content.findById(id);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }

    if (!item.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Item não está disponível'
      });
    }

    // Verifica se usuário tem permissão (premium)
    if (item.isPremium && req.user) {
      if (!['premium', 'vip', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Conteúdo premium requer assinatura'
        });
      }
    }

    logger.info(`Stream solicitado: ${type}/${id} - ${item.title}`);

    // HTML5 <video> não envia header Authorization.
    // Então retornamos uma URL interna com token curto na query para autenticação.
    let upstreamHost;
    try {
      upstreamHost = new URL(String(item.streamUrl)).hostname;
    } catch {
      upstreamHost = undefined;
    }

    const token = signStreamToken({
      type,
      id,
      user: req.user,
      upstreamHost,
      clientIp: getClientIp(req),
    });
    const playbackUrl = `${req.protocol}://${req.get('host')}/api/stream/proxy/${type}/${id}?token=${encodeURIComponent(token)}`;

    res.json({
      success: true,
      data: {
        streamUrl: playbackUrl,
        streamType: item.streamType,
        title: item.title,
        thumbnail: item.thumbnail || item.poster
      }
    });
  } catch (error) {
    next(error);
  }
};

export const proxyStream = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const token = req.query.token;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token de stream ausente' });
    }

    const decoded = verifyStreamToken(token);
    if (decoded?.type !== type || String(decoded?.id) !== String(id)) {
      return res.status(403).json({ success: false, message: 'Token não corresponde ao stream solicitado' });
    }
    if (STREAM_TOKEN_BIND_IP) {
      const ipNow = getClientIp(req);
      if (decoded?.ip && ipNow && String(decoded.ip) !== String(ipNow)) {
        return res.status(401).json({ success: false, message: 'Token de stream inválido para este IP' });
      }
    }

    let item;
    if (type === 'channel') {
      item = await Channel.findById(id);
    } else if (type === 'content') {
      item = await Content.findById(id);
    }

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item não encontrado' });
    }
    if (!item.isActive) {
      return res.status(403).json({ success: false, message: 'Item não está disponível' });
    }
    if (item.isPremium) {
      const role = decoded?.role;
      if (!['premium', 'vip', 'admin'].includes(role)) {
        return res.status(403).json({ success: false, message: 'Conteúdo premium requer assinatura' });
      }
    }

    // HLS playlist: reescreve para que segmentos/chaves também sejam tokenizados
    if (String(item.streamUrl).includes('.m3u8')) {
      const playlistResp = await axios.get(item.streamUrl, {
        responseType: 'arraybuffer',
        timeout: STREAM_UPSTREAM_PLAYLIST_TIMEOUT_MS,
        maxRedirects: STREAM_UPSTREAM_MAX_REDIRECTS,
        validateStatus: () => true,
        headers: {
          Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*',
        },
      });

      const finalUrl = getAxiosFinalUrl(playlistResp, item.streamUrl);
      const playlistText = Buffer.from(playlistResp.data || '').toString('utf8');
      const proxyBase = `${req.protocol}://${req.get('host')}`;
      const rewritten = rewriteM3u8({ playlistText, playlistUrl: finalUrl, proxyBase, token });

      res.status(200);
      res.set('Content-Type', 'application/vnd.apple.mpegurl');
      res.set('Cache-Control', 'no-store');
      res.set('Access-Control-Allow-Origin', '*');
      res.send(rewritten);
      return;
    }

    // MP4 etc
    const range = req.headers.range;
    const controller = new AbortController();
    const abortUpstream = () => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    };
    req.on('aborted', abortUpstream);
    res.on('close', abortUpstream);

    const upstream = await axios.get(item.streamUrl, {
      responseType: 'stream',
      timeout: STREAM_UPSTREAM_INACTIVITY_TIMEOUT_MS,
      maxRedirects: STREAM_UPSTREAM_MAX_REDIRECTS,
      validateStatus: () => true,
      signal: controller.signal,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        ...(range ? { Range: range } : {}),
      },
    });

    res.status(upstream.status);
    res.set('Cache-Control', 'no-store');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.set('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges,Content-Type');

    const passthrough = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified',
    ];
    for (const key of passthrough) {
      const v = upstream.headers?.[key];
      if (v) res.set(key, v);
    }
    if (!upstream.headers?.['accept-ranges']) {
      res.set('accept-ranges', 'bytes');
    }

    let clientClosed = false;
    req.on('aborted', () => {
      clientClosed = true;
    });
    res.on('close', () => {
      clientClosed = true;
      try {
        upstream.data?.destroy?.();
      } catch {
        // ignore
      }
    });

    upstream.data.on('error', (err) => {
      if (clientClosed) return;
      logger.warn('Stream upstream error', { message: err?.message, code: err?.code });
      try {
        res.destroy(err);
      } catch {
        // ignore
      }
    });

    upstream.data.pipe(res);
  } catch (error) {
    if (isClientAbortCancel(error)) {
      // Client disconnected; avoid noisy 500s/log spam.
      return;
    }
    next(error);
  }
};

export const fetchStreamResource = async (req, res, next) => {
  try {
    const token = req.query.token;
    const rawUrl = req.query.url;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token de stream ausente' });
    }
    if (!rawUrl) {
      return res.status(400).json({ success: false, message: 'URL ausente' });
    }

    const decoded = verifyStreamToken(token);
    if (STREAM_TOKEN_BIND_IP) {
      const ipNow = getClientIp(req);
      if (decoded?.ip && ipNow && String(decoded.ip) !== String(ipNow)) {
        return res.status(401).json({ success: false, message: 'Token de stream inválido para este IP' });
      }
    }

    const allowedHosts = getAllowedUpstreamHosts(decoded?.upHost);
    const u = assertUpstreamUrlAllowed(rawUrl, allowedHosts);

    const range = req.headers.range;
    const controller = new AbortController();
    const abortUpstream = () => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    };
    req.on('aborted', abortUpstream);
    res.on('close', abortUpstream);

    const upstream = await axios.get(u.toString(), {
      responseType: 'stream',
      timeout: STREAM_UPSTREAM_INACTIVITY_TIMEOUT_MS,
      maxRedirects: STREAM_UPSTREAM_MAX_REDIRECTS,
      validateStatus: () => true,
      signal: controller.signal,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        ...(range ? { Range: range } : {}),
      },
    });

    res.status(upstream.status);
    res.set('Cache-Control', 'no-store');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.set('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges,Content-Type');

    const passthrough = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified',
    ];
    for (const key of passthrough) {
      const v = upstream.headers?.[key];
      if (v) res.set(key, v);
    }
    if (!upstream.headers?.['accept-ranges']) {
      res.set('accept-ranges', 'bytes');
    }

    let clientClosed = false;
    req.on('aborted', () => {
      clientClosed = true;
    });
    res.on('close', () => {
      clientClosed = true;
      try {
        upstream.data?.destroy?.();
      } catch {
        // ignore
      }
    });

    upstream.data.on('error', (err) => {
      if (clientClosed) return;
      logger.warn('Stream fetch upstream error', { message: err?.message, code: err?.code });
      try {
        res.destroy(err);
      } catch {
        // ignore
      }
    });

    upstream.data.pipe(res);
  } catch (error) {
    if (isClientAbortCancel(error)) {
      return;
    }
    next(error);
  }
};

export const validateStream = async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL não fornecida'
      });
    }

    // Aqui você pode implementar validação de URL
    // Por exemplo, testar se o stream está acessível
    
    res.json({
      success: true,
      data: {
        valid: true,
        type: url.includes('.m3u8') ? 'hls' : 'mp4'
      }
    });
  } catch (error) {
    next(error);
  }
};
