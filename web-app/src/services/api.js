import axios from 'axios';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';
import { localAuth } from './localAuth';
import { supabaseAuth } from './supabaseAuth';
import { getPersistScopeUserId } from './scopedStorage';
import { 
  mockChannels, 
  mockMovies, 
  mockSeries, 
  mockCategories,
  mockUser 
} from './mockData';

// Base do proxy IPTV (API/stream) para evitar CORS.
// Pode ser sobrescrito via VITE_IPTV_PROXY_URL, ex: http://localhost:3101
export const IPTV_PROXY_BASE_URL = import.meta.env.VITE_IPTV_PROXY_URL || 'http://localhost:3101';

// Client-side timeout when calling the proxy endpoints.
// Heavy Xtream actions can legitimately take longer on some providers.
const CLIENT_TIMEOUT_DEFAULT_MS = Number(import.meta.env.VITE_IPTV_CLIENT_TIMEOUT_MS || 30000);
const CLIENT_TIMEOUT_HEAVY_MS = Number(import.meta.env.VITE_IPTV_CLIENT_HEAVY_TIMEOUT_MS || 120000);

const proxyImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith(IPTV_PROXY_BASE_URL)) return url;
  return `${IPTV_PROXY_BASE_URL}/img?url=${encodeURIComponent(url)}`;
};

const normalizeText = (value) => {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const slugify = (value) => {
  const t = normalizeText(value);
  if (!t) return '';
  return t.replace(/\s+/g, '-');
};

const hashId = (value) => {
  const str = String(value || '');
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Unsigned 32-bit to base36
  return (hash >>> 0).toString(36);
};

let m3uCache = {
  url: null,
  fetchedAt: 0,
  entries: [],
  byId: new Map(),
  groupsByType: {
    live: [],
    vod: [],
    series: [],
  },
};

const parseM3uAttributes = (raw) => {
  const out = {};
  const src = String(raw || '').trim();
  if (!src) return out;

  const re = /([a-zA-Z0-9_:-]+)=("[^"]*"|'[^']*'|[^\s]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
};

const inferM3uEntryType = ({ groupTitle, title }) => {
  const g = normalizeText(groupTitle);
  const t = normalizeText(title);

  const hasSeries = g.includes('series') || g.includes('serie') || g.includes('tv shows') || t.includes('s0') || t.includes('season');
  if (hasSeries) return 'series';

  const hasVod = g.includes('vod') || g.includes('movie') || g.includes('filme') || g.includes('filmes') || g.includes('movies');
  if (hasVod) return 'vod';

  return 'live';
};

const parseM3u = (text) => {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const info = line;

      const commaIdx = info.indexOf(',');
      const metaPart = commaIdx >= 0 ? info.slice(0, commaIdx) : info;
      const titlePart = commaIdx >= 0 ? info.slice(commaIdx + 1).trim() : '';

      const attrsRaw = metaPart.split(':').slice(1).join(':');
      const attrs = parseM3uAttributes(attrsRaw);

      let url = '';
      // Next non-empty, non-comment line is the URL.
      for (let j = i + 1; j < lines.length; j += 1) {
        const candidate = lines[j];
        if (!candidate) continue;
        if (candidate.startsWith('#')) continue;
        url = candidate;
        i = j; // advance outer loop
        break;
      }

      if (!url) continue;

      const groupTitle = attrs['group-title'] || attrs.group || '';
      const title = titlePart || attrs['tvg-name'] || attrs['tvg-id'] || url;
      const logo = attrs['tvg-logo'] || attrs.logo || null;
      const type = inferM3uEntryType({ groupTitle, title });

      const id = hashId(`${type}|${groupTitle}|${title}|${url}`);
      entries.push({ id, type, title, groupTitle, logo, url });
    }
  }
  return entries;
};

const stripBom = (text) => String(text || '').replace(/^\uFEFF/, '');

const looksLikeM3u = (text) => {
  const t = stripBom(text).trimStart();
  if (!t) return false;
  if (t.startsWith('#EXTM3U')) return true;
  // Some providers omit the header but keep EXTINF entries.
  return /(^|\n)#EXTINF:/i.test(t);
};

const fetchTextWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 1));
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      text,
    };
  } finally {
    clearTimeout(timer);
  }
};

const loadM3uCache = async (opts = {}) => {
  const credentials = getIptvCredentials();
  const m3uUrl = String(credentials?.m3uUrl || '').trim();
  if (!m3uUrl) return null;

  const ttlMs = Number(opts?.ttlMs ?? 5 * 60 * 1000);
  const now = Date.now();
  const sameUrl = m3uCache.url === m3uUrl;
  const fresh = sameUrl && now - m3uCache.fetchedAt < ttlMs;
  if (fresh && m3uCache.entries.length) return m3uCache;

  const proxyUrl = `${IPTV_PROXY_BASE_URL}/stream?url=${encodeURIComponent(m3uUrl)}`;
  const res = await fetchTextWithTimeout(proxyUrl, CLIENT_TIMEOUT_DEFAULT_MS);
  const body = typeof res?.text === 'string' ? res.text : '';

  if (!res?.ok) {
    const sample = stripBom(body).trim().slice(0, 200);
    throw new Error(`Falha ao baixar M3U (HTTP ${res?.status || 'erro'}). ${sample ? `Resposta: ${sample}` : ''}`.trim());
  }

  if (!looksLikeM3u(body)) {
    const sample = stripBom(body).trim().slice(0, 200);
    throw new Error(`Lista M3U inválida${res?.contentType ? ` (${res.contentType})` : ''}${sample ? `: ${sample}` : ''}`);
  }

  const entries = parseM3u(stripBom(body));
  const byId = new Map();
  entries.forEach((e) => byId.set(String(e.id), e));

  const groups = { live: new Map(), vod: new Map(), series: new Map() };
  for (const e of entries) {
    const gt = String(e.groupTitle || '').trim();
    const type = e.type;
    if (!gt) continue;
    const id = slugify(gt) || hashId(gt);
    if (!groups[type].has(id)) {
      groups[type].set(id, { _id: id, name: gt, type: type === 'vod' ? 'vod' : type });
    }
  }

  m3uCache = {
    url: m3uUrl,
    fetchedAt: now,
    entries,
    byId,
    groupsByType: {
      live: Array.from(groups.live.values()),
      vod: Array.from(groups.vod.values()),
      series: Array.from(groups.series.values()),
    },
  };

  logger.debug('m3u.cache.loaded', {
    entries: entries.length,
    liveGroups: m3uCache.groupsByType.live.length,
    vodGroups: m3uCache.groupsByType.vod.length,
    seriesGroups: m3uCache.groupsByType.series.length,
  });

  return m3uCache;
};

// Função para obter credenciais do localStorage
const getIptvCredentials = () => {
  try {
    const scopedKey = `univision:persist:${getPersistScopeUserId()}:iptv-credentials`;
    const stored = localStorage.getItem(scopedKey) || localStorage.getItem('iptv-credentials');
    if (stored) {
      const data = JSON.parse(stored);
      return data?.state?.credentials || null;
    }
  } catch (error) {
    logger.error('iptv.credentials.read_failed', undefined, error);
  }
  return null;
};

const normalizeBaseUrl = (apiUrl) => {
  if (!apiUrl) return null;
  let baseUrl = apiUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    // Most providers work better on HTTPS when scheme is omitted.
    baseUrl = 'https://' + baseUrl;
  }
  baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
  return baseUrl;
};

// Backend API base (optional). Use same-origin by default so dev-server proxy can be used when backend is running.
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Backend auth is optional. On Cloudflare Pages we typically do NOT have an auth backend,
// so defaulting to same-origin `/api/auth/*` causes 405 errors.
// Only try backend auth when explicitly enabled via `VITE_TRY_BACKEND=true`.
const SHOULD_TRY_BACKEND = String(import.meta.env.VITE_TRY_BACKEND || '').toLowerCase() === 'true';
const shouldTryBackend = () => SHOULD_TRY_BACKEND;

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const buildXtreamPlayerApiBase = () => {
  const credentials = getIptvCredentials();
  if (!credentials?.apiUrl) return null;

  let baseUrl = credentials.apiUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }

  const fullUrl = `${baseUrl}player_api.php?username=${credentials.username}&password=${credentials.password}`;
  return { fullUrl };
};

// Função para criar cliente API com credenciais IPTV
const createIptvClient = () => {
  const credentials = getIptvCredentials();
  
  if (!credentials?.apiUrl) {
    return null;
  }

  // Construir URL completa com credenciais
  let baseUrl = credentials.apiUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }
  
  const fullUrl = `${baseUrl}player_api.php?username=${credentials.username}&password=${credentials.password}`;

  // Retornar um objeto que encapsula o cliente para tratamento especial
  return {
    get: async (url, config) => {
      // Adicionar action e outros params à URL antes de chamar o proxy
      const params = config?.params || {};
      const action = String(params?.action || '');
      const limit = params?.limit;
      const q = params?.q;
      const queryString = Object.keys(params)
        .filter(key => key !== 'type' && key !== 'limit' && key !== 'q') // Remover params locais (não são da API)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
      
      const finalUrl = queryString 
        ? `${fullUrl}&${queryString}`
        : fullUrl;
      
      const proxyUrl = `${IPTV_PROXY_BASE_URL}/iptv?url=${encodeURIComponent(finalUrl)}${
        limit !== undefined && limit !== null && String(limit) !== '' ? `&limit=${encodeURIComponent(limit)}` : ''
      }${
        q !== undefined && q !== null && String(q).trim() !== '' ? `&q=${encodeURIComponent(String(q))}` : ''
      }`;

      const isHeavy = action === 'get_live_streams' || action === 'get_vod_streams' || action === 'get_series' || action === 'get_series_info';
      const timeout = isHeavy ? CLIENT_TIMEOUT_HEAVY_MS : CLIENT_TIMEOUT_DEFAULT_MS;

      logger.debug('iptv.proxy.get', {
        action,
        params,
        hasQueryString: !!queryString,
        timeout,
      });
      
      return axios.get(proxyUrl, {
        timeout,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    post: async (url, data, config) => {
      // Similar para POST se necessário
      const params = config?.params || {};
      const limit = params?.limit;
      const q = params?.q;
      const queryString = Object.keys(params)
        .filter(key => key !== 'type' && key !== 'limit' && key !== 'q')
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
      
      const finalUrl = queryString 
        ? `${fullUrl}&${queryString}`
        : fullUrl;
      
      const proxyUrl = `${IPTV_PROXY_BASE_URL}/iptv?url=${encodeURIComponent(finalUrl)}${
        limit !== undefined && limit !== null && String(limit) !== '' ? `&limit=${encodeURIComponent(limit)}` : ''
      }${
        q !== undefined && q !== null && String(q).trim() !== '' ? `&q=${encodeURIComponent(String(q))}` : ''
      }`;

      const action = String(params?.action || '');
      const isHeavy = action === 'get_live_streams' || action === 'get_vod_streams' || action === 'get_series' || action === 'get_series_info';
      const timeout = isHeavy ? CLIENT_TIMEOUT_HEAVY_MS : CLIENT_TIMEOUT_DEFAULT_MS;
      
      return axios.post(proxyUrl, data, {
        timeout,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  };
};

// Função auxiliar para tentar API real primeiro, depois mock
const fetchWithMock = async (fn, mockData) => {
  const credentials = getIptvCredentials();
  const iptvClient = createIptvClient();
  
  // Se tiver credenciais configuradas, tenta usar a API real
  if (iptvClient) {
    logger.debug('fetchWithMock.try_iptv', {
      apiUrl: credentials?.apiUrl,
      hasUsername: !!credentials?.username,
      hasPassword: !!credentials?.password,
    });
    
    try {
      const response = await fn(iptvClient);
      logger.debug('fetchWithMock.iptv_ok');
      return response;
    } catch (error) {
      logger.warn(
        'fetchWithMock.iptv_failed',
        {
          message: error?.message,
          status: error?.response?.status,
        },
        error
      );
    }
  } else {
    logger.debug('fetchWithMock.no_iptv_credentials');
  }
  
  // Tenta API padrão (backend) apenas quando habilitado
  if (shouldTryBackend()) {
    try {
      logger.debug('fetchWithMock.try_default_api');
      const response = await fn(api);
      logger.debug('fetchWithMock.default_api_ok');
      return response;
    } catch (error) {
      logger.warn('fetchWithMock.default_api_failed', { message: error?.message });
    }
  } else {
    logger.debug('fetchWithMock.skip_default_api_in_dev');
  }
  
  logger.info('fetchWithMock.using_mock');
  return mockData;
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - sem toast para requests com fallback
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'Erro ao processar requisição';
    
    // Token expirado
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      toast.error('Sessão expirada. Faça login novamente.');
    } else if (error.response?.status === 403) {
      toast.error('Você não tem permissão para esta ação');
    } else if (error.response?.status >= 500) {
      // Não mostrar erro para server-side errors quando usando mock
    }
    
    return Promise.reject(error);
  }
);

export default api;

const makeClientError = (message, status = 400) => {
  const err = new Error(String(message || 'Erro'));
  err.response = { status, data: { message: String(message || 'Erro') } };
  return err;
};

const isSupabaseEnabled = () => {
  try {
    return Boolean(supabaseAuth?.isEnabled?.());
  } catch {
    return false;
  }
};

// Auth endpoints
// This repo often runs without a backend API. In that case, we use a local (per-device) auth database.
// If a backend is later added, set `VITE_TRY_BACKEND=true` to prefer server auth in dev.
export const authAPI = {
  register: async (data) => {
    // Easiest production path: Supabase Auth (cross-device)
    if (isSupabaseEnabled()) {
      try {
        const res = await supabaseAuth.register(data || {});
        if (res?.needsEmailConfirmation) {
          return {
            ...res,
            message: 'Cadastro realizado. Confirme o email para entrar.',
          };
        }
        return { ...res, message: 'Cadastro realizado' };
      } catch (err) {
        throw makeClientError(err?.message || 'Erro ao cadastrar', 400);
      }
    }

    try {
      if (shouldTryBackend()) return await api.post('/auth/register', data);
    } catch (err) {
      logger.debug('auth.register.backend_failed', { message: err?.message });
    }

    try {
      const res = await localAuth.register(data || {});
      return { ...res, message: 'Cadastro realizado' };
    } catch (err) {
      throw makeClientError(err?.message || 'Erro ao cadastrar', 400);
    }
  },

  login: async (data) => {
    if (isSupabaseEnabled()) {
      try {
        const res = await supabaseAuth.login(data || {});
        return { ...res, message: 'Login realizado' };
      } catch (err) {
        throw makeClientError(err?.message || 'Email ou senha incorretos', 401);
      }
    }

    try {
      if (shouldTryBackend()) return await api.post('/auth/login', data);
    } catch (err) {
      logger.debug('auth.login.backend_failed', { message: err?.message });
    }

    try {
      const res = await localAuth.login(data || {});
      return { ...res, message: 'Login realizado' };
    } catch (err) {
      throw makeClientError(err?.message || 'Erro ao fazer login', 401);
    }
  },

  logout: async () => {
    try {
      if (isSupabaseEnabled()) {
        try {
          await supabaseAuth.logout();
        } catch {
          // ignore
        }
      }

      if (shouldTryBackend()) {
        try {
          await api.post('/auth/logout');
        } catch {
          // ignore
        }
      }
    } finally {
      await localAuth.logout();
    }
    return { success: true };
  },

  getMe: async () => {
    if (isSupabaseEnabled()) {
      try {
        return await supabaseAuth.getMe();
      } catch (err) {
        throw makeClientError(err?.message || 'Sessão inválida', 401);
      }
    }

    try {
      if (shouldTryBackend()) return await api.get('/auth/me');
    } catch (err) {
      logger.debug('auth.getMe.backend_failed', { message: err?.message });
    }

    try {
      return await localAuth.getMe();
    } catch (err) {
      throw makeClientError(err?.message || 'Sessão inválida', 401);
    }
  },

  updateProfile: async (data) => {
    if (isSupabaseEnabled()) {
      try {
        return await supabaseAuth.updateProfile(data || {});
      } catch (err) {
        throw makeClientError(err?.message || 'Erro ao atualizar perfil', 400);
      }
    }

    try {
      if (shouldTryBackend()) return await api.put('/auth/profile', data);
    } catch (err) {
      logger.debug('auth.updateProfile.backend_failed', { message: err?.message });
    }

    try {
      return await localAuth.updateProfile(data || {});
    } catch (err) {
      throw makeClientError(err?.message || 'Erro ao atualizar perfil', 400);
    }
  },
};

// Channels endpoints com fallback mock
export const channelsAPI = {
  getAll: (params) => {
    const credentials = getIptvCredentials();
    const hasXtream = Boolean(credentials?.apiUrl && credentials?.username && credentials?.password);
    const hasM3u = Boolean(String(credentials?.m3uUrl || '').trim());

    if (!hasXtream && hasM3u) {
      return loadM3uCache().then((cache) => {
        const list = Array.isArray(cache?.entries) ? cache.entries : [];
        const q = normalizeText(params?.q);
        const category = String(params?.category || '').trim();

        let filtered = list.filter((e) => e.type === 'live');
        if (category && category !== 'all' && category !== '__m3u__') {
          filtered = filtered.filter((e) => slugify(e.groupTitle) === category);
        }
        if (q) {
          filtered = filtered.filter((e) => normalizeText(e.title).includes(q));
        }

        if (params?.limit && Number.isFinite(Number(params.limit))) {
          filtered = filtered.slice(0, Number(params.limit));
        }

        const channels = filtered.map((e) => ({
          _id: e.id,
          title: e.title,
          name: e.title,
          logo: proxyImageUrl(e.logo),
          streamUrl: e.url,
          category: e.groupTitle || null,
          isLive: true,
        }));

        return { channels, total: channels.length, page: 1, limit: params?.limit ? Number(params.limit) : 20 };
      });
    }

    return fetchWithMock(
    (client) => {
      const clientParams = { action: 'get_live_streams' };
      if (params?.category) {
        clientParams.category_id = params.category;
      }
      if (params?.limit !== undefined && params?.limit !== null && String(params.limit) !== '') {
        clientParams.limit = params.limit;
      }
      if (params?.q) {
        clientParams.q = params.q;
      }
      return client.get('', { params: clientParams }).then(res => {
        // Transformar resposta Xtream Codes para nosso formato
        // res é a resposta direta do axios (já com .data extraído pelo interceptor)
        logger.debug('channels.getAll.raw', {
          type: typeof res,
          isArray: Array.isArray(res),
          length: Array.isArray(res) ? res.length : undefined,
        });
        
        // Se recebeu um objeto com user_info, significa que não passou o action
        if (res && typeof res === 'object' && res.user_info) {
          logger.warn('channels.getAll.unexpected_user_info');
          return { channels: [], total: 0, page: 1, limit: 20 };
        }
        
        let streams = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);

        const total = streams.length;
        if (params?.limit && Number.isFinite(Number(params.limit))) {
          streams = streams.slice(0, Number(params.limit));
        }

        logger.debug('channels.getAll.streams', {
          count: streams.length,
          firstKeys: streams[0] && typeof streams[0] === 'object' ? Object.keys(streams[0]).slice(0, 12) : undefined,
        });
        
        const credentials = getIptvCredentials();
        const baseUrl = normalizeBaseUrl(credentials?.apiUrl) || 'http://localhost:8000';
        
        const channels = streams.map(stream => {
          // Muitos provedores retornam live como .ts (MPEG-TS). Outros retornam .m3u8.
          // Não forçar .m3u8 aqui — use o que o painel indicar quando possível.
          const ext = String(stream?.container_extension || 'm3u8').replace(/^\./, '');
          const fallbackUrl = `${baseUrl}/live/${credentials?.username}/${credentials?.password}/${stream.stream_id}.${ext}`;

          return {
          _id: stream.stream_id || stream.id,
          title: stream.name,
          number: stream.num,
          logo: proxyImageUrl(stream.stream_icon),
          streamUrl: stream.stream_url || fallbackUrl,
          category: stream.category_name,
          isLive: true,
          };
        });
        return { channels, total, page: 1, limit: params?.limit ? Number(params.limit) : 20 };
      });
    },
    { channels: mockChannels, total: mockChannels.length, page: 1, limit: 20 }
    );
  },
  getById: (id) => {
    const credentials = getIptvCredentials();
    const hasXtream = Boolean(credentials?.apiUrl && credentials?.username && credentials?.password);
    const hasM3u = Boolean(String(credentials?.m3uUrl || '').trim());

    if (!hasXtream && hasM3u) {
      return loadM3uCache().then((cache) => {
        const e = cache?.byId?.get(String(id));
        if (!e) return { channel: null };
        return {
          channel: {
            _id: e.id,
            title: e.title,
            name: e.title,
            logo: proxyImageUrl(e.logo),
            streamUrl: e.url,
          },
        };
      });
    }

    return fetchWithMock(
    (client) => client.get('', { 
      params: { action: 'get_live_info', stream_id: id } 
    }).then(res => {
      logger.debug('channels.getById.raw', {
        id,
        type: typeof res,
        isArray: Array.isArray(res),
      });
      
      // Tratar resposta - pode ser um objeto direto ou com .data
      const info = (res && typeof res === 'object') 
        ? (res.info || res) 
        : res;
      
      const credentials = getIptvCredentials();
      const baseUrl = normalizeBaseUrl(credentials?.apiUrl) || 'http://localhost:8000';

      const ext = String(info?.container_extension || 'm3u8').replace(/^\./, '');
      const streamUrl = info.stream_url || `${baseUrl}/live/${credentials?.username}/${credentials?.password}/${id}.${ext}`;
      
      return { 
        channel: {
          _id: info.stream_id || id,
          title: info.name,
          logo: proxyImageUrl(info.stream_icon),
          streamUrl: streamUrl,
        }
      };
    }),
      { channel: mockChannels.find(c => c._id === id) }
    );
  },
  getFeatured: () => fetchWithMock(
    (client) => client.get('', { 
      params: { action: 'get_live_streams' } 
    }).then(res => {
      // Se recebeu user_info, algo deu errado
      if (res && typeof res === 'object' && res.user_info) {
        logger.warn('channels.getFeatured.unexpected_user_info');
        return { channels: [] };
      }
      
      const streams = Array.isArray(res) ? res.slice(0, 10) : (Array.isArray(res.data) ? res.data.slice(0, 10) : []);

      const credentials = getIptvCredentials();
      const baseUrl = normalizeBaseUrl(credentials?.apiUrl) || 'http://localhost:8000';

      const channels = streams.map(stream => {
        const ext = String(stream?.container_extension || 'm3u8').replace(/^\./, '');
        const fallbackUrl = `${baseUrl}/live/${credentials?.username}/${credentials?.password}/${stream.stream_id}.${ext}`;
        return {
          _id: stream.stream_id || stream.id,
          title: stream.name,
          logo: proxyImageUrl(stream.stream_icon),
          streamUrl: stream.stream_url || fallbackUrl,
        };
      });
      return { channels };
    }),
    { channels: mockChannels.slice(0, 6) }
  ),
  create: (data) => api.post('/channels', data),
  update: (id, data) => api.put(`/channels/${id}`, data),
  delete: (id) => api.delete(`/channels/${id}`),
};

// Content endpoints com fallback mock
export const contentAPI = {
  getAll: (params) => {
    const credentials = getIptvCredentials();
    const hasXtream = Boolean(credentials?.apiUrl && credentials?.username && credentials?.password);
    const hasM3u = Boolean(String(credentials?.m3uUrl || '').trim());

    if (!hasXtream && hasM3u) {
      return loadM3uCache().then((cache) => {
        const list = Array.isArray(cache?.entries) ? cache.entries : [];
        const requestedType = params?.type === 'series' ? 'series' : 'vod';
        const q = normalizeText(params?.q);
        const category = String(params?.category || '').trim();

        let filtered = list.filter((e) => e.type === requestedType);
        if (category && category !== 'all' && category !== '__m3u__') {
          filtered = filtered.filter((e) => slugify(e.groupTitle) === category);
        }
        if (q) {
          filtered = filtered.filter((e) => normalizeText(e.title).includes(q));
        }

        if (params?.limit && Number.isFinite(Number(params.limit))) {
          filtered = filtered.slice(0, Number(params.limit));
        }

        const contents = filtered.map((e) => ({
          _id: e.id,
          title: e.title,
          name: e.title,
          poster: proxyImageUrl(e.logo),
          backdrop: proxyImageUrl(e.logo),
          description: null,
          year: null,
          rating: 0,
          type: params?.type || 'movie',
          category: e.groupTitle || null,
          streamUrl: e.url,
        }));

        return {
          contents,
          total: contents.length,
          page: 1,
          limit: params?.limit ? Number(params.limit) : 20,
        };
      });
    }

    return fetchWithMock(
    (client) => {
      const action = params?.type === 'series' 
        ? 'get_series' 
        : params?.type === 'movie'
        ? 'get_vod_streams'
        : 'get_vod_streams';
      
      const clientParams = { action };
      if (params?.category) {
        clientParams.category_id = params.category;
      }
      if (params?.limit !== undefined && params?.limit !== null && String(params.limit) !== '') {
        clientParams.limit = params.limit;
      }
      if (params?.q) {
        clientParams.q = params.q;
      }
      
      return client.get('', { params: clientParams }).then(res => {
        // Tratar resposta tanto como array direto (proxy) quanto como objeto com data
        logger.debug('content.getAll.raw', {
          type: typeof res,
          isArray: Array.isArray(res),
          length: Array.isArray(res) ? res.length : undefined,
          action,
        });
        
        // Se recebeu user_info, algo deu errado com a URL
        if (res && typeof res === 'object' && res.user_info) {
          logger.warn('content.getAll.unexpected_user_info', { action });
          return { contents: [], total: 0, page: 1, limit: 20 };
        }
        
        let streams = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);

        const total = streams.length;
        if (params?.limit && Number.isFinite(Number(params.limit))) {
          streams = streams.slice(0, Number(params.limit));
        }

        logger.debug('content.getAll.streams', {
          count: streams.length,
          firstKeys: streams[0] && typeof streams[0] === 'object' ? Object.keys(streams[0]).slice(0, 12) : undefined,
        });
        
        const credentials = getIptvCredentials();
        let baseUrl = credentials?.apiUrl || 'http://localhost:8000';
        
        // Remover /player_api.php se existir na URL base
        baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
        
        const contents = streams.map(stream => {
          let streamUrl = stream.stream_url;
          
          // Se não tiver stream_url, construir com base no tipo
          if (!streamUrl) {
            const id = stream.stream_id || stream.series_id;
            const extension = stream.container_extension || 'm3u8';
            
            if (params?.type === 'series') {
              // Para séries: /series/username/password/series_id.extension
              streamUrl = `${baseUrl}/series/${credentials?.username}/${credentials?.password}/${id}.${extension}`;
            } else {
              // Para filmes: /movie/username/password/stream_id.extension
              streamUrl = `${baseUrl}/movie/${credentials?.username}/${credentials?.password}/${id}.${extension}`;
            }
          }
          
          // Preferir cover (TMDB) sobre stream_icon
          const poster = proxyImageUrl(stream.cover || stream.stream_icon);
          
          return {
            _id: stream.stream_id || stream.series_id || stream.id,
            title: stream.name,
            poster: poster,
            backdrop: proxyImageUrl(stream.backdrop_path?.[0] || stream.cover),
            description: stream.plot || stream.description,
            year: stream.releaseDate || stream.year,
            rating: stream.rating || 0,
            type: params?.type || 'movie',
            category: stream.category_name,
            streamUrl: streamUrl,
          };
        });
        return {
          contents,
          total,
          page: 1,
          limit: params?.limit ? Number(params.limit) : 20,
        };
      });
    },
    { 
      contents: params?.type === 'series' 
        ? mockSeries 
        : params?.type === 'movie'
        ? mockMovies
        : [...mockMovies, ...mockSeries],
      total: mockMovies.length + mockSeries.length,
      page: 1,
      limit: 20
    }
    );
  },
  getById: (id) => {
    const credentials = getIptvCredentials();
    const hasXtream = Boolean(credentials?.apiUrl && credentials?.username && credentials?.password);
    const hasM3u = Boolean(String(credentials?.m3uUrl || '').trim());

    if (!hasXtream && hasM3u) {
      return loadM3uCache().then((cache) => {
        const e = cache?.byId?.get(String(id));
        if (!e) return { content: null };
        return {
          content: {
            _id: e.id,
            title: e.title,
            poster: proxyImageUrl(e.logo),
            description: null,
            year: null,
            rating: 0,
            duration: null,
            streamUrl: e.url,
          },
        };
      });
    }

    return fetchWithMock(
    (client) => client.get('', { 
      params: { action: 'get_vod_info', vod_id: id } 
    }).then(res => {
      logger.debug('content.getById.raw', { id, type: typeof res });
      
      // Tratar resposta - pode ser um objeto direto ou com .data
      const payload = res?.data ?? res;
      const info = (payload && typeof payload === 'object') ? (payload.info || payload) : payload;
      const movieData = (payload && typeof payload === 'object') ? (payload.movie_data || payload.movieData || null) : null;
      
      const credentials = getIptvCredentials();
      let baseUrl = credentials?.apiUrl || 'http://localhost:8000';
      
      // Remover /player_api.php se existir na URL base
      baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
      
      let streamUrl = info?.stream_url;
      if (!streamUrl) {
        const ext = info?.container_extension || movieData?.container_extension || 'm3u8';
        streamUrl = `${baseUrl}/movie/${credentials?.username}/${credentials?.password}/${id}.${ext}`;
      }

      const genreRaw = info?.genre || movieData?.genre;
      const genre = typeof genreRaw === 'string'
        ? genreRaw.split(',').map((g) => g.trim()).filter(Boolean)
        : Array.isArray(genreRaw)
          ? genreRaw
          : null;

      const durationSecs = Number(info?.duration_secs || movieData?.duration_secs || 0);
      const duration = durationSecs > 0 ? Math.round(durationSecs / 60) : (info?.duration || movieData?.duration || null);

      const description =
        info?.plot ||
        info?.description ||
        movieData?.plot ||
        movieData?.description ||
        null;

      const posterRaw = info?.stream_icon || info?.cover || movieData?.stream_icon || movieData?.cover;
      
      return { 
        content: {
          _id: info?.stream_id || movieData?.stream_id || id,
          title: info?.name || movieData?.name,
          poster: proxyImageUrl(posterRaw),
          description,
          year: info?.releaseDate || movieData?.releaseDate || info?.year || movieData?.year,
          rating: info?.rating || movieData?.rating,
          duration,
          metadata: {
            genre: genre || undefined,
          },
          streamUrl: streamUrl,
        }
      };
    }),
      { content: [...mockMovies, ...mockSeries].find(c => c._id === id) }
    );
  },
  create: (data) => api.post('/content', data),
  update: (id, data) => api.put(`/content/${id}`, data),
  delete: (id) => api.delete(`/content/${id}`),
  
  // Series endpoints para temporadas e episódios
  getSeriesInfo: (params) => {
    return fetchWithMock(
      (client) => {
        const seriesId = params?.series_id;
        if (!seriesId) return Promise.resolve({ seasons: [], info: null, episodesBySeason: {} });

        // Prefer server-side processing via proxy to avoid shipping huge episode payloads to the client.
        const base = buildXtreamPlayerApiBase()?.fullUrl;
        if (base) {
          const url = `${IPTV_PROXY_BASE_URL}/series/info?base=${encodeURIComponent(base)}&series_id=${encodeURIComponent(seriesId)}`;
          return axios
            .get(url, { timeout: 30000, headers: { 'Content-Type': 'application/json' } })
            .then((r) => ({ seasons: r?.data?.seasons || [], info: r?.data?.info || null, episodesBySeason: {} }))
            .catch((err) => {
              logger.warn('series.getSeriesInfo.proxy_failed', { message: err?.message });
              return null;
            })
            .then((proxyResult) => {
              if (proxyResult) return proxyResult;
              // Fallback: direct Xtream call (returns large payload)
              return client
                .get('', { params: { action: 'get_series_info', series_id: seriesId } })
                .then((res) => {
                  const payload = res?.data ?? res;

                  if (!payload || (typeof payload === 'object' && payload.user_info)) {
                    logger.warn('series.getSeriesInfo.unexpected_payload');
                    return { seasons: [], info: null, episodesBySeason: {} };
                  }

                  const seasonsRaw = Array.isArray(payload.seasons) ? payload.seasons : [];
                  const seasons = seasonsRaw
                    .map((s) => ({
                      season_number: Number(s.season_number ?? s.season ?? s.number ?? 0),
                      episode_count: Number(s.episode_count ?? s.episodes ?? 0),
                    }))
                    .filter((s) => Number.isFinite(s.season_number) && s.season_number > 0);

                  // Intentionally keep episodesBySeason only in fallback mode.
                  const episodesBySeason =
                    payload.episodes && typeof payload.episodes === 'object' ? payload.episodes : {};

                  return { seasons, info: payload.info || null, episodesBySeason };
                });
            });
        }

        return client
          .get('', { params: { action: 'get_series_info', series_id: seriesId } })
          .then((res) => {
            const payload = res?.data ?? res;

            if (!payload || (typeof payload === 'object' && payload.user_info)) {
              logger.warn('series.getSeriesInfo.unexpected_payload');
              return { seasons: [], info: null, episodesBySeason: {} };
            }

            const seasonsRaw = Array.isArray(payload.seasons) ? payload.seasons : [];
            const seasons = seasonsRaw
              .map((s) => ({
                season_number: Number(s.season_number ?? s.season ?? s.number ?? 0),
                episode_count: Number(s.episode_count ?? s.episodes ?? 0),
              }))
              .filter((s) => Number.isFinite(s.season_number) && s.season_number > 0);

            const episodesBySeason =
              payload.episodes && typeof payload.episodes === 'object' ? payload.episodes : {};

            return { seasons, info: payload.info || null, episodesBySeason };
          });
      },
      { seasons: [], info: null, episodesBySeason: {} }
    );
  },
  
  getSeriesEpisodes: (params) => {
    const seriesId = params?.series_id;
    const seasonNumber = Number(params?.season_number ?? 1);

    const base = buildXtreamPlayerApiBase()?.fullUrl;
    if (base && seriesId) {
      const url = `${IPTV_PROXY_BASE_URL}/series/episodes?base=${encodeURIComponent(base)}&series_id=${encodeURIComponent(seriesId)}&season_number=${encodeURIComponent(seasonNumber)}`;
      return axios
        .get(url, { timeout: 30000, headers: { 'Content-Type': 'application/json' } })
        .then((r) => ({ episodes: r?.data?.episodes || [] }))
        .catch((err) => {
          logger.warn('series.getSeriesEpisodes.proxy_failed', { message: err?.message });
          return null;
        })
        .then((proxyResult) => {
          if (proxyResult) return proxyResult;
          // Fallback to legacy client-side mapping
          return contentAPI.getSeriesInfo({ series_id: seriesId }).then((info) => {
            const episodesBySeason = info?.episodesBySeason || {};
            const seasonKey = String(seasonNumber);
            const rawList = Array.isArray(episodesBySeason[seasonKey]) ? episodesBySeason[seasonKey] : [];

            const credentials = getIptvCredentials();
            const baseUrl = normalizeBaseUrl(credentials?.apiUrl);

            const episodes = rawList
              .map((ep) => {
                const episodeId = ep?.id ?? ep?.episode_id ?? ep?.stream_id;
                const ext = ep?.container_extension || 'mp4';

                // Alguns provedores já mandam URL direta
                const direct = ep?.direct_source;

                const streamUrl =
                  direct ||
                  (baseUrl && credentials?.username && credentials?.password && episodeId
                    ? `${baseUrl}/series/${credentials.username}/${credentials.password}/${episodeId}.${ext}`
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

            return { episodes };
          });
        });
    }

    return contentAPI.getSeriesInfo({ series_id: seriesId }).then((info) => {
      const episodesBySeason = info?.episodesBySeason || {};
      const seasonKey = String(seasonNumber);
      const rawList = Array.isArray(episodesBySeason[seasonKey]) ? episodesBySeason[seasonKey] : [];

      const credentials = getIptvCredentials();
      const baseUrl = normalizeBaseUrl(credentials?.apiUrl);

      const episodes = rawList
        .map((ep) => {
          const episodeId = ep?.id ?? ep?.episode_id ?? ep?.stream_id;
          const ext = ep?.container_extension || 'mp4';

          // Alguns provedores já mandam URL direta
          const direct = ep?.direct_source;

          const streamUrl =
            direct ||
            (baseUrl && credentials?.username && credentials?.password && episodeId
              ? `${baseUrl}/series/${credentials.username}/${credentials.password}/${episodeId}.${ext}`
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

      return { episodes };
    });
  },
};

// Função auxiliar para gerar episódios mock
const generateMockEpisodes = (params) => {
  const episodesPerSeason = {
    1: 13, 2: 13, 3: 13, 4: 16
  };
  
  const seasonNumber = params.season_number || 1;
  const episodeCount = episodesPerSeason[seasonNumber] || 10;
  
  logger.trace('series.mock_episodes.generate', { episodeCount, seasonNumber });
  
  // Pegar credenciais para montar URL
  const credentials = getIptvCredentials();
  let baseUrl = credentials?.apiUrl || 'http://localhost:8000';
  baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
  
  const seriesId = params.series_id;
  
  // Padrão IPTV real: /series/username/password/series_id.mp4
  // Gerar IDs fictícios para cada episódio (simular série com múltiplos IDs)
  const episodes = Array.from({ length: episodeCount }, (_, i) => {
    const episodeNum = i + 1;
    
    // Gerar um ID único por episódio (simular série fragmentada)
    // Usar série_id como base e adicionar offset para cada episódio
    const episodeSeriesId = parseInt(seriesId) + i;
    
    // URL seguindo padrão real
    const streamUrl = `${baseUrl}/series/${credentials?.username}/${credentials?.password}/${episodeSeriesId}.mp4`;
    
    return {
      id: `${seriesId}_s${seasonNumber}e${String(episodeNum).padStart(2, '0')}`,
      episode_number: episodeNum,
      season_number: seasonNumber,
      title: `Episódio ${episodeNum}`,
      plot: `Episódio ${episodeNum} da temporada ${seasonNumber}`,
      streamUrl: streamUrl,
    };
  });
  
  logger.trace('series.mock_episodes.generated', { count: episodes.length });
  return { episodes };
};

// Helper para fetch com mock síncrono
const fetchWithMockSync = async (fetchFn, mockFn) => {
  try {
    return await fetchFn(createIptvClient());
  } catch (err) {
    logger.warn('fetchWithMockSync.using_mock', { message: err?.message });
    return mockFn();
  }
};

// Categories endpoints com fallback mock
export const categoriesAPI = {
  getAll: (params) => {
    const credentials = getIptvCredentials();
    const hasXtream = Boolean(credentials?.apiUrl && credentials?.username && credentials?.password);
    const hasM3u = Boolean(String(credentials?.m3uUrl || '').trim());

    if (!hasXtream && hasM3u) {
      return loadM3uCache().then((cache) => {
        const type = params?.type === 'series' ? 'series' : params?.type === 'live' ? 'live' : 'vod';
        const list = Array.isArray(cache?.groupsByType?.[type]) ? cache.groupsByType[type] : [];

        // Ensure at least one selectable category so pages can auto-pick a default.
        const categories = list.length
          ? list
          : [{ _id: '__m3u__', name: 'Lista M3U', type: params?.type || 'vod' }];

        return { categories, total: categories.length };
      });
    }

    return fetchWithMock(
    (client) => {
      // Xtream Codes usa diferentes actions para categorias
      const action = params?.type === 'live' 
        ? 'get_live_categories'
        : params?.type === 'series'
        ? 'get_series_categories'
        : 'get_vod_categories';
      
      return client.get('', { params: { action } }).then(res => {
        // Tratar resposta tanto como array direto (proxy) quanto como objeto com data
        logger.debug('categories.getAll.raw', {
          type: typeof res,
          isArray: Array.isArray(res),
          length: Array.isArray(res) ? res.length : undefined,
          action,
        });
        
        // Se recebeu user_info, algo deu errado com a URL
        if (res && typeof res === 'object' && res.user_info) {
          logger.warn('categories.getAll.unexpected_user_info', { action });
          return { categories: [], total: 0 };
        }
        
        let cats = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);

        logger.debug('categories.getAll.count', { count: cats.length });
        
        const categories = cats.map(cat => ({
          _id: cat.category_id,
          name: cat.category_name,
          type: params?.type || 'movie',
        }));
        return { categories, total: categories.length };
      });
    },
    { categories: mockCategories, total: mockCategories.length }
    );
  },
  getById: (id) => fetchWithMock(
    (client) => client.get('', { 
      params: { action: 'get_vod_categories' } 
    }).then(res => {
      const cats = Array.isArray(res.data) ? res.data : [];
      const category = cats.find(c => c.category_id === id);
      return { category: category ? { _id: category.category_id, name: category.category_name } : null };
    }),
    { category: mockCategories.find(c => c._id === id) }
  ),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// Favorites endpoints com fallback mock
export const favoritesAPI = {
  getAll: (params) => fetchWithMock(
    (client) => client.get('/favorites', { params }).then(res => res.data),
    { favorites: mockMovies.slice(0, 3) }
  ),
  add: (data) => fetchWithMock(
    (client) => client.post('/favorites', data).then(res => res.data),
    { success: true, message: 'Adicionado aos favoritos' }
  ),
  remove: (id) => fetchWithMock(
    (client) => client.delete(`/favorites/${id}`).then(res => res.data),
    { success: true, message: 'Removido dos favoritos' }
  ),
  check: (params) => api.get('/favorites/check', { params }),
};

// History endpoints com fallback mock
export const historyAPI = {
  getAll: (params) => fetchWithMock(
    (client) => client.get('/history', { params }).then(res => res.data),
    { history: mockMovies.slice(0, 5) }
  ),
  getContinueWatching: () => fetchWithMock(
    (client) => client.get('/history/continue').then(res => res.data),
    { items: mockMovies.slice(0, 3) }
  ),
  add: (data) => fetchWithMock(
    (client) => client.post('/history', data).then(res => res.data),
    { success: true }
  ),
  clear: () => api.delete('/history'),
};

// Search endpoints com fallback mock
const SEARCH_INDEX_TTL_MS = 30 * 60 * 1000; // 30 min
const SEARCH_RESULTS_TTL_MS = 5 * 60 * 1000; // 5 min

let searchIndexState = {
  key: null,
  builtAt: 0,
  movies: [],
  series: [],
  building: null,
};

const searchResultsCache = new Map();

const normalizeSearchQuery = (q) => String(q || '').trim().toLowerCase();

const getSearchIndexKey = () => {
  const c = getIptvCredentials();
  if (!c?.apiUrl || !c?.username) return null;
  // Do not include password; just scope to provider + user.
  return `${normalizeBaseUrl(c.apiUrl) || c.apiUrl}|${c.username}`;
};

const ensureSearchIndex = async (client) => {
  const key = getSearchIndexKey();
  if (!key) return { movies: [], series: [] };

  const now = Date.now();
  const isStale = !searchIndexState.builtAt || now - searchIndexState.builtAt > SEARCH_INDEX_TTL_MS;
  const keyChanged = searchIndexState.key !== key;

  if (!keyChanged && !isStale && searchIndexState.movies.length + searchIndexState.series.length > 0) {
    return { movies: searchIndexState.movies, series: searchIndexState.series };
  }

  if (searchIndexState.building && !keyChanged) {
    return searchIndexState.building;
  }

  // Reset when credentials/provider changed
  searchIndexState = {
    key,
    builtAt: 0,
    movies: [],
    series: [],
    building: null,
  };
  searchResultsCache.clear();

  const buildPromise = Promise.all([
    client.get('', { params: { action: 'get_vod_streams' } }).catch(() => []),
    client.get('', { params: { action: 'get_series' } }).catch(() => []),
  ]).then(([moviesRaw, seriesRaw]) => {
    const movies = (Array.isArray(moviesRaw) ? moviesRaw : (Array.isArray(moviesRaw?.data) ? moviesRaw.data : []))
      .map((m) => ({
        stream_id: m.stream_id,
        name: m.name,
        stream_icon: m.stream_icon,
        cover: m.cover,
        container_extension: m.container_extension,
        stream_url: m.stream_url,
      }))
      .filter((m) => m.stream_id && m.name);

    const series = (Array.isArray(seriesRaw) ? seriesRaw : (Array.isArray(seriesRaw?.data) ? seriesRaw.data : []))
      .map((s) => ({
        series_id: s.series_id,
        name: s.name,
        stream_icon: s.stream_icon,
        cover: s.cover,
        container_extension: s.container_extension,
        stream_url: s.stream_url,
      }))
      .filter((s) => s.series_id && s.name);

    searchIndexState.movies = movies;
    searchIndexState.series = series;
    searchIndexState.builtAt = Date.now();
    searchIndexState.building = null;
    return { movies, series };
  }).catch((err) => {
    searchIndexState.building = null;
    throw err;
  });

  searchIndexState.building = buildPromise;
  return buildPromise;
};

export const searchAPI = {
  search: (params) => fetchWithMock(
    (client) => {
      const q = normalizeSearchQuery(params?.query);
      const limit = Number.isFinite(Number(params?.limit)) ? Number(params.limit) : 50;
      if (!q || q.length < 2) return Promise.resolve({ results: [] });

      const key = getSearchIndexKey() || 'no-key';
      const cacheKey = `${key}:${q}:${limit}`;
      const cached = searchResultsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return Promise.resolve({ results: cached.results });
      }

      return ensureSearchIndex(client).then(({ movies, series }) => {
        const credentials = getIptvCredentials();
        const baseUrl = normalizeBaseUrl(credentials?.apiUrl) || 'http://localhost:8000';

        const movieList = (movies || [])
          .filter((m) => m.name && String(m.name).toLowerCase().includes(q))
          .slice(0, limit)
          .map((m) => {
            const id = m.stream_id;
            const extension = m.container_extension || 'm3u8';
            const streamUrl = m.stream_url || `${baseUrl}/movie/${credentials?.username}/${credentials?.password}/${id}.${extension}`;
            return {
              _id: id,
              title: m.name,
              poster: proxyImageUrl(m.cover || m.stream_icon),
              type: 'movie',
              streamUrl,
            };
          });

        const remaining = Math.max(0, limit - movieList.length);
        const seriesList = (series || [])
          .filter((s) => s.name && String(s.name).toLowerCase().includes(q))
          .slice(0, remaining)
          .map((s) => {
            const id = s.series_id;
            const extension = s.container_extension || 'm3u8';
            const streamUrl = s.stream_url || `${baseUrl}/series/${credentials?.username}/${credentials?.password}/${id}.${extension}`;
            return {
              _id: id,
              title: s.name,
              poster: proxyImageUrl(s.cover || s.stream_icon),
              type: 'series',
              streamUrl,
            };
          });

        const results = [...movieList, ...seriesList];
        searchResultsCache.set(cacheKey, { results, expiresAt: Date.now() + SEARCH_RESULTS_TTL_MS });
        return { results };
      });
    },
    {
      results: [
        ...mockMovies.filter(c => c.title.toLowerCase().includes(params?.query?.toLowerCase() || '')).slice(0, 5),
        ...mockSeries.filter(s => s.title.toLowerCase().includes(params?.query?.toLowerCase() || '')).slice(0, 5)
      ]
    }
  ),
  suggestions: (params) => api.get('/search/suggestions', { params }),
};

// EPG endpoints com fallback mock
export const epgAPI = {
  get: (params) => fetchWithMock(
    () => api.get('/epg', { params }),
    { schedule: [] }
  ),
  getWeek: (params) => fetchWithMock(
    () => api.get('/epg/week', { params }),
    { schedule: [] }
  ),
};

// Stream endpoints
export const streamAPI = {
  getUrl: (type, id) => api.get(`/stream/${type}/${id}`),
  validate: (data) => api.post('/stream/validate', data),
};

export const resetSearchCaches = () => {
  // Reset search index and cached results so next search rebuilds fresh data.
  searchIndexState = {
    key: '',
    builtAt: 0,
    movies: [],
    series: [],
    building: null,
  };
  searchResultsCache.clear();
};

// Users endpoints (Admin only)
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  getStats: () => api.get('/users/stats'),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};
