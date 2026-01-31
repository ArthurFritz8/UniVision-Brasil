import axios from 'axios';
import toast from 'react-hot-toast';
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

// Função para obter credenciais do localStorage
const getIptvCredentials = () => {
  try {
    const stored = localStorage.getItem('iptv-credentials');
    if (stored) {
      const data = JSON.parse(stored);
      return data?.state?.credentials || null;
    }
  } catch (error) {
    console.error('Error reading IPTV credentials:', error);
  }
  return null;
};

const normalizeBaseUrl = (apiUrl) => {
  if (!apiUrl) return null;
  let baseUrl = apiUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'http://' + baseUrl;
  }
  baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
  return baseUrl;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Função para criar cliente API com credenciais IPTV
const createIptvClient = () => {
  const credentials = getIptvCredentials();
  
  if (!credentials?.apiUrl) {
    return null;
  }

  // Construir URL completa com credenciais
  let baseUrl = credentials.apiUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'http://' + baseUrl;
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
      const queryString = Object.keys(params)
        .filter(key => key !== 'type') // Remover 'type' que não é um parâmetro da API
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
      
      const finalUrl = queryString 
        ? `${fullUrl}&${queryString}`
        : fullUrl;
      
      const proxyUrl = `${IPTV_PROXY_BASE_URL}/iptv?url=${encodeURIComponent(finalUrl)}`;
      
      console.log('🔗 URL Final para proxy:', finalUrl);
      console.log('🔗 Query String:', queryString);
      console.log('🔗 Params recebidos:', params);
      
      return axios.get(proxyUrl, {
        timeout: 30000, // 30 segundos
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    post: async (url, data, config) => {
      // Similar para POST se necessário
      const params = config?.params || {};
      const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
      
      const finalUrl = queryString 
        ? `${fullUrl}&${queryString}`
        : fullUrl;
      
      const proxyUrl = `${IPTV_PROXY_BASE_URL}/iptv?url=${encodeURIComponent(finalUrl)}`;
      
      return axios.post(proxyUrl, data, {
        timeout: 30000, // 30 segundos
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
    console.log('🔄 Tentando API IPTV:', {
      url: credentials?.apiUrl,
      username: credentials?.username,
      hasPassword: !!credentials?.password
    });
    
    try {
      const response = await fn(iptvClient);
      console.log('✅ Conteúdo carregado da API IPTV:', response);
      return response;
    } catch (error) {
      console.error('❌ API IPTV falhou:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
    }
  } else {
    console.warn('⚠️ Sem credenciais IPTV configuradas');
  }
  
  // Tenta API padrão
  try {
    console.log('🔄 Tentando API padrão...');
    const response = await fn(api);
    console.log('✅ Dados da API padrão');
    return response;
  } catch (error) {
    console.warn('⚠️ API padrão indisponível, usando dados mock');
  }
  
  console.log('📦 Usando dados mock');
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

// Auth endpoints com fallback mock
export const authAPI = {
  register: (data) => fetchWithMock(
    () => api.post('/auth/register', data).then(res => {
      // Se for bem-sucedido, salvar o usuário com os dados corretos
      const userData = res.data?.user || { name: data.name, email: data.email };
      return { success: true, message: 'Cadastro realizado', user: userData, token: res.data?.token || 'mock-token-' + Date.now() };
    }).catch(error => {
      // Em caso de erro, criar usuário localmente
      return { success: true, message: 'Cadastro realizado', user: { name: data.name, email: data.email, _id: Date.now() }, token: 'mock-token-' + Date.now() };
    }),
    { success: true, message: 'Cadastro realizado', user: { name: mockUser.name, email: mockUser.email }, token: 'mock-token-' + Date.now() }
  ),
  login: (data) => fetchWithMock(
    () => api.post('/auth/login', data),
    { success: true, token: 'mock-token-' + Date.now(), user: mockUser }
  ),
  logout: () => api.post('/auth/logout'),
  getMe: () => fetchWithMock(
    () => api.get('/auth/me'),
    { user: mockUser }
  ),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
};

// Channels endpoints com fallback mock
export const channelsAPI = {
  getAll: (params) => fetchWithMock(
    (client) => {
      const clientParams = { action: 'get_live_streams' };
      if (params?.category) {
        clientParams.category_id = params.category;
      }
      if (params?.limit) {
        clientParams.limit = params.limit;
      }
      return client.get('', { params: clientParams }).then(res => {
        // Transformar resposta Xtream Codes para nosso formato
        // res é a resposta direta do axios (já com .data extraído pelo interceptor)
        console.log('📦 Raw response:', typeof res, Array.isArray(res), JSON.stringify(res).substring(0, 200));
        
        // Se recebeu um objeto com user_info, significa que não passou o action
        if (res && typeof res === 'object' && res.user_info) {
          console.error('⚠️ Recebeu user_info em vez de streams. A URL pode estar incorreta.');
          return { channels: [], total: 0, page: 1, limit: 20 };
        }
        
        let streams = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);
        
        console.log('🔍 Streams recebidos:', streams.length, 'itens', streams.slice(0, 1));
        
        const credentials = getIptvCredentials();
        let baseUrl = credentials?.apiUrl || 'http://localhost:8000';
        
        // Remover /player_api.php se existir na URL base
        baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
        
        const channels = streams.map(stream => ({
          _id: stream.stream_id || stream.id,
          title: stream.name,
          number: stream.num,
          logo: stream.stream_icon,
          streamUrl: stream.stream_url || `${baseUrl}/live/${credentials?.username}/${credentials?.password}/${stream.stream_id}.m3u8`,
          category: stream.category_name,
          isLive: true,
        }));
        return { channels, total: channels.length, page: 1, limit: 20 };
      });
    },
    { channels: mockChannels, total: mockChannels.length, page: 1, limit: 20 }
  ),
  getById: (id) => fetchWithMock(
    (client) => client.get('', { 
      params: { action: 'get_live_info', stream_id: id } 
    }).then(res => {
      console.log('📺 getById resposta:', typeof res, Array.isArray(res), JSON.stringify(res).substring(0, 300));
      
      // Tratar resposta - pode ser um objeto direto ou com .data
      const info = (res && typeof res === 'object') 
        ? (res.info || res) 
        : res;
      
      const credentials = getIptvCredentials();
      let baseUrl = credentials?.apiUrl || 'http://localhost:8000';
      
      // Remover /player_api.php se existir na URL base
      baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
      
      const streamUrl = info.stream_url || `${baseUrl}/live/${credentials?.username}/${credentials?.password}/${id}.m3u8`;
      
      return { 
        channel: {
          _id: info.stream_id || id,
          title: info.name,
          logo: info.stream_icon,
          streamUrl: streamUrl,
        }
      };
    }),
    { channel: mockChannels.find(c => c._id === id) }
  ),
  getFeatured: () => fetchWithMock(
    (client) => client.get('', { 
      params: { action: 'get_live_streams' } 
    }).then(res => {
      // Se recebeu user_info, algo deu errado
      if (res && typeof res === 'object' && res.user_info) {
        console.error('⚠️ Recebeu user_info em vez de streams.');
        return { channels: [] };
      }
      
      const streams = Array.isArray(res) ? res.slice(0, 10) : (Array.isArray(res.data) ? res.data.slice(0, 10) : []);
      const channels = streams.map(stream => ({
        _id: stream.stream_id || stream.id,
        title: stream.name,
        logo: stream.stream_icon,
        streamUrl: stream.stream_url,
      }));
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
  getAll: (params) => fetchWithMock(
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
      if (params?.limit) {
        clientParams.limit = params.limit;
      }
      
      return client.get('', { params: clientParams }).then(res => {
        // Tratar resposta tanto como array direto (proxy) quanto como objeto com data
        console.log('📦 Content Raw response:', typeof res, Array.isArray(res), JSON.stringify(res).substring(0, 200));
        
        // Se recebeu user_info, algo deu errado com a URL
        if (res && typeof res === 'object' && res.user_info) {
          console.error('⚠️ Recebeu user_info em vez de conteúdos.');
          return { contents: [], total: 0, page: 1, limit: 20 };
        }
        
        let streams = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);
        
        console.log('🔍 Conteúdos recebidos:', streams.length, 'itens', streams.slice(0, 1));
        
        // Log detalhado do primeiro item para debug
        if (streams.length > 0) {
          console.log('🎬 Primeiro conteúdo completo:', JSON.stringify(streams[0], null, 2));
        }
        
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
          const poster = stream.cover || stream.stream_icon;
          
          return {
            _id: stream.stream_id || stream.series_id || stream.id,
            title: stream.name,
            poster: poster,
            backdrop: stream.backdrop_path?.[0] || stream.cover,
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
          total: contents.length,
          page: 1,
          limit: 20
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
  ),
  getById: (id) => fetchWithMock(
    (client) => client.get('', { 
      params: { action: 'get_vod_info', vod_id: id } 
    }).then(res => {
      console.log('🎬 getById VOD resposta:', typeof res, JSON.stringify(res).substring(0, 300));
      
      // Tratar resposta - pode ser um objeto direto ou com .data
      const info = (res && typeof res === 'object') 
        ? (res.info || res) 
        : res;
      
      const credentials = getIptvCredentials();
      let baseUrl = credentials?.apiUrl || 'http://localhost:8000';
      
      // Remover /player_api.php se existir na URL base
      baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
      
      let streamUrl = info.stream_url;
      if (!streamUrl) {
        streamUrl = `${baseUrl}/movie/${credentials?.username}/${credentials?.password}/${id}.m3u8`;
      }
      
      return { 
        content: {
          _id: info.stream_id || id,
          title: info.name,
          poster: info.stream_icon || info.cover,
          description: info.plot,
          year: info.releaseDate,
          rating: info.rating,
          streamUrl: streamUrl,
        }
      };
    }),
    { content: [...mockMovies, ...mockSeries].find(c => c._id === id) }
  ),
  create: (data) => api.post('/content', data),
  update: (id, data) => api.put(`/content/${id}`, data),
  delete: (id) => api.delete(`/content/${id}`),
  
  // Series endpoints para temporadas e episódios
  getSeriesInfo: (params) => {
    return fetchWithMock(
      (client) => {
        const seriesId = params?.series_id;
        if (!seriesId) return Promise.resolve({ seasons: [], info: null, episodesBySeason: {} });

        return client
          .get('', { params: { action: 'get_series_info', series_id: seriesId } })
          .then((res) => {
            const payload = res?.data ?? res;

            if (!payload || (typeof payload === 'object' && payload.user_info)) {
              console.warn('⚠️ get_series_info retornou payload inesperado');
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
  
  console.log('📺 Gerando episódios mock:', episodeCount, 'para temporada', seasonNumber);
  
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
  
  console.log('📺 Episódios mock gerados:', episodes.length);
  if (episodes.length > 0) {
    console.log('📺 Exemplo URL episódio 1:', episodes[0].streamUrl);
  }
  return { episodes };
};

// Helper para fetch com mock síncrono
const fetchWithMockSync = async (fetchFn, mockFn) => {
  try {
    return await fetchFn(createIptvClient());
  } catch (err) {
    console.log('📡 Usando fallback mock:', err.message);
    return mockFn();
  }
};

// Categories endpoints com fallback mock
export const categoriesAPI = {
  getAll: (params) => fetchWithMock(
    (client) => {
      // Xtream Codes usa diferentes actions para categorias
      const action = params?.type === 'live' 
        ? 'get_live_categories'
        : params?.type === 'series'
        ? 'get_series_categories'
        : 'get_vod_categories';
      
      return client.get('', { params: { action } }).then(res => {
        // Tratar resposta tanto como array direto (proxy) quanto como objeto com data
        console.log('📦 Categories Raw response:', typeof res, Array.isArray(res), JSON.stringify(res).substring(0, 200));
        
        // Se recebeu user_info, algo deu errado com a URL
        if (res && typeof res === 'object' && res.user_info) {
          console.error('⚠️ Recebeu user_info em vez de categorias.');
          return { categories: [], total: 0 };
        }
        
        let cats = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : []);
        
        console.log('🔍 Categorias recebidas:', cats.length, 'itens', cats.slice(0, 2));
        
        const categories = cats.map(cat => ({
          _id: cat.category_id,
          name: cat.category_name,
          type: params?.type || 'movie',
        }));
        return { categories, total: categories.length };
      });
    },
    { categories: mockCategories, total: mockCategories.length }
  ),
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
export const searchAPI = {
  search: (params) => fetchWithMock(
    (client) => {
      // Xtream Codes não tem busca nativa. Trazer todo conteúdo e filtrar localmente
      return Promise.all([
        client.get('', { params: { action: 'get_vod_streams' } }).catch(() => []),
        client.get('', { params: { action: 'get_series' } }).catch(() => []),
      ]).then(([movies, series]) => {
        const credentials = getIptvCredentials();
        let baseUrl = credentials?.apiUrl || 'http://localhost:8000';
        baseUrl = baseUrl.replace('/player_api.php', '').replace(/\/$/, '');
        
        // Filtrar por query
        const query = (params?.query || '').toLowerCase();
        
        const movieList = (Array.isArray(movies) ? movies : (Array.isArray(movies?.data) ? movies.data : []))
          .filter(m => m.name && m.name.toLowerCase().includes(query))
          .map(m => {
          const id = m.stream_id;
          const extension = m.container_extension || 'm3u8';
          const streamUrl = m.stream_url || `${baseUrl}/movie/${credentials?.username}/${credentials?.password}/${id}.${extension}`;
          return {
            _id: id,
            title: m.name,
            poster: m.stream_icon,
            type: 'movie',
            streamUrl
          };
        });
        
        const seriesList = (Array.isArray(series) ? series : (Array.isArray(series?.data) ? series.data : []))
          .filter(s => s.name && s.name.toLowerCase().includes(query))
          .map(s => {
          const id = s.series_id;
          const extension = s.container_extension || 'm3u8';
          const streamUrl = s.stream_url || `${baseUrl}/series/${credentials?.username}/${credentials?.password}/${id}.${extension}`;
          return {
            _id: id,
            title: s.name,
            poster: s.stream_icon,
            type: 'series',
            streamUrl
          };
        });
        
        return { results: [...movieList, ...seriesList] };
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

// Users endpoints (Admin only)
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  getStats: () => api.get('/users/stats'),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};
