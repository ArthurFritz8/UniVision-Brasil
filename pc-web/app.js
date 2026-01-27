// UniVision Brasil (Web) - Lógica principal
// Comentários e UI em pt-BR

const state = {
  dados: null,
  categoriaAtual: 'ao_vivo',
  favoritos: new Set(JSON.parse(localStorage.getItem('favoritos') || '[]')),
  settings: {
    endpoint: localStorage.getItem('endpoint') || '',
    username: localStorage.getItem('username') || '',
    password: localStorage.getItem('password') || '',
    m3uUrl: localStorage.getItem('m3uUrl') || ''
  }
};

const el = {
  grid: document.getElementById('grid'),
  catTitle: document.getElementById('categoria-titulo'),
  status: document.getElementById('status'),
  menuItems: document.querySelectorAll('.menu-item'),
  playerOverlay: document.getElementById('player-overlay'),
  playerTitle: document.getElementById('player-title'),
  playerState: document.getElementById('player-state'),
  playerVideo: document.getElementById('player'),
  playerClose: document.getElementById('player-close'),
  settingsModal: document.getElementById('settings-modal'),
  endpoint: document.getElementById('endpoint'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  m3uUrl: document.getElementById('m3uUrl'),
  saveSettings: document.getElementById('save-settings'),
  closeSettings: document.getElementById('close-settings')
};

init();

function init() {
  // Eventos de menu
  el.menuItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (cat === 'config') {
        abrirConfig();
        return;
      }
      if (cat === 'minha_lista') {
        mostrarFavoritos();
        return;
      }
      state.categoriaAtual = cat;
      renderCategoriaTitulo(cat);
      renderGridPorCategoria(cat);
    });
  });

  // Player
  el.playerClose.addEventListener('click', fecharPlayer);
  el.playerVideo.addEventListener('waiting', () => el.playerState.textContent = 'Carregando...');
  el.playerVideo.addEventListener('playing', () => el.playerState.textContent = 'Reproduzindo');
  el.playerVideo.addEventListener('pause', () => el.playerState.textContent = 'Pausado');
  el.playerVideo.addEventListener('error', () => el.playerState.textContent = 'Erro ao reproduzir vídeo');

  // Settings
  el.endpoint.value = state.settings.endpoint;
  el.username.value = state.settings.username;
  el.password.value = state.settings.password;
  el.m3uUrl.value = state.settings.m3uUrl;
  el.saveSettings.addEventListener('click', salvarConfig);
  el.closeSettings.addEventListener('click', () => el.settingsModal.classList.add('hidden'));

  carregarDados().then(() => {
    renderCategoriaTitulo(state.categoriaAtual);
    renderGridPorCategoria(state.categoriaAtual);
  });
}

function abrirConfig() {
  el.settingsModal.classList.remove('hidden');
}

function salvarConfig() {
  state.settings.endpoint = el.endpoint.value.trim();
  state.settings.username = el.username.value.trim();
  state.settings.password = el.password.value.trim();
  state.settings.m3uUrl = el.m3uUrl.value.trim();

  localStorage.setItem('endpoint', state.settings.endpoint);
  localStorage.setItem('username', state.settings.username);
  localStorage.setItem('password', state.settings.password);
  localStorage.setItem('m3uUrl', state.settings.m3uUrl);

  el.settingsModal.classList.add('hidden');
  carregarDados().then(() => {
    renderCategoriaTitulo(state.categoriaAtual);
    renderGridPorCategoria(state.categoriaAtual);
  });
}

async function carregarDados() {
  el.status.textContent = 'Carregando dados...';
  try {
    const ep = state.settings.endpoint;
    const user = state.settings.username;
    const pass = state.settings.password;
    const m3u = state.settings.m3uUrl;

    let dados = null;
    if (ep && ep.startsWith('http') && user && pass) {
      // Carrega primeiro apenas Ao Vivo para ficar rápido
      const live = await obterLiveXtream(ep, user, pass);
      dados = {
        categorias: [
          { id: 'ao_vivo', nome: 'TV Ao Vivo' },
          { id: 'filmes', nome: 'Filmes' },
          { id: 'series', nome: 'Séries' }
        ],
        canais: live,
        conteudos: [],
      };
      dados.flags = { filmesLoaded: false, seriesLoaded: false, origem: 'xtream' };
      dados.xt = { base: ep, user, pass };
    }
    if (!dados && m3u) {
      dados = await obterDadosM3U(m3u);
    }
    if (!dados) {
      dados = obterMock();
    }
    state.dados = dados;
    el.status.textContent = 'Pronto';
  } catch (e) {
    console.error(e);
    el.status.textContent = 'Erro ao carregar dados';
    state.dados = obterMock();
  }
}

function renderCategoriaTitulo(catId) {
  const cat = (state.dados?.categorias || []).find(c => c.id === catId);
  el.catTitle.textContent = cat ? cat.nome : 'Conteúdo';
}

async function renderGridPorCategoria(catId) {
  el.grid.innerHTML = '';
  let lista = [];
  if (catId === 'ao_vivo') {
    lista = state.dados.canais || [];
  } else if (catId === 'filmes' || catId === 'series') {
    await carregarCategoriaSeNecessario(catId);
    lista = (state.dados.conteudos || []).filter(c => c.categoriaId === catId);
  }
  if (!lista || lista.length === 0) {
    const vazio = document.createElement('div');
    vazio.className = 'empty';
    vazio.textContent = 'Nenhum item encontrado.';
    el.grid.appendChild(vazio);
    return;
  }
  // Renderização em pedaços para evitar travamentos
  const CHUNK = 40;
  let i = 0;
  function renderChunk() {
    const end = Math.min(i + CHUNK, lista.length);
    for (; i < end; i++) {
      const item = lista[i];
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${item.imagem}" alt="${escapeHtml(item.titulo)}">
        <div class="title">${escapeHtml(item.titulo)}</div>
        <div class="actions">
          <button class="btn btn-play">Reproduzir</button>
          <button class="btn btn-fav">${state.favoritos.has(item.id) ? 'Remover' : 'Favoritar'}</button>
        </div>
      `;
      card.querySelector('.btn-play').addEventListener('click', () => reproduzir(item));
      card.querySelector('.btn-fav').addEventListener('click', () => {
        alternarFavorito(item);
        card.querySelector('.btn-fav').textContent = state.favoritos.has(item.id) ? 'Remover' : 'Favoritar';
      });
      el.grid.appendChild(card);
    }
    if (i < lista.length) requestAnimationFrame(renderChunk);
  }
  requestAnimationFrame(renderChunk);
}

function mostrarFavoritos() {
  document.getElementById('categoria-titulo').textContent = 'Minha Lista';
  el.grid.innerHTML = '';
  const ids = Array.from(state.favoritos);
  const todos = [...(state.dados.canais || []), ...(state.dados.conteudos || [])];
  const lista = todos.filter(it => ids.includes(it.id));
  lista.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${item.imagem}" alt="${escapeHtml(item.titulo)}">
      <div class="title">${escapeHtml(item.titulo)}</div>
      <div class="actions">
        <button class="btn btn-play">Reproduzir</button>
        <button class="btn btn-fav">Remover</button>
      </div>
    `;
    card.querySelector('.btn-play').addEventListener('click', () => reproduzir(item));
    card.querySelector('.btn-fav').addEventListener('click', () => {
      alternarFavorito(item);
      card.remove();
    });
    el.grid.appendChild(card);
  });
}

function alternarFavorito(item) {
  if (state.favoritos.has(item.id)) {
    state.favoritos.delete(item.id);
  } else {
    state.favoritos.add(item.id);
  }
  localStorage.setItem('favoritos', JSON.stringify(Array.from(state.favoritos)));
}

function reproduzir(item) {
  el.playerTitle.textContent = item.titulo;
  el.playerState.textContent = 'Carregando...';
  el.playerOverlay.classList.remove('hidden');

  const url = item.stream;
  const fmt = item.formato || (url.endsWith('.m3u8') ? 'hls' : 'mp4');

  // Limpa qualquer HLS anterior
  if (window.__currentHls) {
    try { window.__currentHls.destroy(); } catch {}
    window.__currentHls = null;
  }
  el.playerVideo.src = '';

  let started = false;
  const startTimeout = setTimeout(() => {
    if (!started) el.playerState.textContent = 'Não foi possível iniciar a reprodução.';
  }, 8000);

  const onPlaying = () => { started = true; clearTimeout(startTimeout); el.playerState.textContent = 'Reproduzindo'; };
  el.playerVideo.addEventListener('playing', onPlaying, { once: true });

  if (fmt === 'hls' && Hls.isSupported()) {
    const hls = new Hls({ maxBufferLength: 10 });
    window.__currentHls = hls;
    hls.loadSource(url);
    hls.attachMedia(el.playerVideo);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      el.playerVideo.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data && data.fatal) {
        try { hls.destroy(); } catch {}
        el.playerState.textContent = 'Erro de reprodução (HLS).';
      }
    });
  } else {
    el.playerVideo.src = url;
    el.playerVideo.play().catch(() => {});
  }
}

function fecharPlayer() {
  el.playerOverlay.classList.add('hidden');
  try { el.playerVideo.pause(); } catch {}
  el.playerVideo.src = '';
}

function escapeHtml(str) {
  return str.replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}

function obterMock() {
  return {
    categorias: [
      { id: 'ao_vivo', nome: 'TV Ao Vivo' },
      { id: 'filmes', nome: 'Filmes' },
      { id: 'series', nome: 'Séries' }
    ],
    canais: [
      {
        id: 'globo', titulo: 'Globo (Exemplo)', categoriaId: 'ao_vivo',
        stream: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', formato: 'hls',
        imagem: 'https://via.placeholder.com/300x450.png?text=Globo'
      },
      {
        id: 'sbt', titulo: 'SBT (Exemplo)', categoriaId: 'ao_vivo',
        stream: 'https://test-streams.mux.dev/test_001/stream.m3u8', formato: 'hls',
        imagem: 'https://via.placeholder.com/300x450.png?text=SBT'
      },
      {
        id: 'tnt', titulo: 'TNT Sports (Exemplo)', categoriaId: 'ao_vivo',
        stream: 'https://test-streams.mux.dev/pts/pts.m3u8', formato: 'hls',
        imagem: 'https://via.placeholder.com/300x450.png?text=TNT'
      }
    ],
    conteudos: [
      {
        id: 'bbb', titulo: 'Big Buck Bunny (Filme)', categoriaId: 'filmes',
        stream: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', formato: 'mp4',
        imagem: 'https://via.placeholder.com/300x450.png?text=BBB'
      },
      {
        id: 'sintel', titulo: 'Sintel (Filme)', categoriaId: 'filmes',
        stream: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', formato: 'mp4',
        imagem: 'https://via.placeholder.com/300x450.png?text=Sintel'
      }
    ]
  };
}

async function obterDadosXtream(base, user, pass) {
  // Nota: pode exigir proxy por CORS
  base = base.endsWith('/') ? base.slice(0, -1) : base;
  const api = `${base}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
  const live = await xtGet(`${api}&action=get_live_streams`);
  const vod = await xtGet(`${api}&action=get_vod_streams`);
  const series = await xtGet(`${api}&action=get_series`);
  const categorias = [
    { id: 'ao_vivo', nome: 'TV Ao Vivo' },
    { id: 'filmes', nome: 'Filmes' },
    { id: 'series', nome: 'Séries' }
  ];
  const canais = (live || []).map(it => ({
    id: String(it.stream_id),
    titulo: it.name,
    categoriaId: 'ao_vivo',
    stream: `${base}/live/${user}/${pass}/${it.stream_id}.m3u8`,
    formato: 'hls',
    imagem: it.stream_icon || 'https://via.placeholder.com/300x450.png?text=Ao+Vivo'
  }));
  const conteudos = [];
  (vod || []).forEach(it => {
    conteudos.push({
      id: String(it.stream_id),
      titulo: it.name,
      categoriaId: 'filmes',
      stream: `${base}/movie/${user}/${pass}/${it.stream_id}.mp4`,
      formato: 'mp4',
      imagem: it.stream_icon || 'https://via.placeholder.com/300x450.png?text=Filme'
    });
  });
  (series || []).forEach(it => {
    conteudos.push({
      id: String(it.series_id),
      titulo: it.name,
      categoriaId: 'series',
      stream: `${base}/series/${user}/${pass}/${it.series_id}.m3u8`,
      formato: 'hls',
      imagem: it.cover || 'https://via.placeholder.com/300x450.png?text=Serie'
    });
  });
  return { categorias, canais, conteudos };
}

// Versões segmentadas para carregamento sob demanda
async function obterLiveXtream(base, user, pass) {
  base = base.endsWith('/') ? base.slice(0, -1) : base;
  const api = `${base}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
  const live = await xtGet(`${api}&action=get_live_streams`);
  return (live || []).map(it => ({
    id: String(it.stream_id),
    titulo: it.name,
    categoriaId: 'ao_vivo',
    stream: `${base}/live/${user}/${pass}/${it.stream_id}.m3u8`,
    formato: 'hls',
    imagem: it.stream_icon || 'https://via.placeholder.com/300x450.png?text=Ao+Vivo'
  }));
}

async function obterVodXtream(base, user, pass) {
  base = base.endsWith('/') ? base.slice(0, -1) : base;
  const api = `${base}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
  const vod = await xtGet(`${api}&action=get_vod_streams`);
  return (vod || []).map(it => ({
    id: String(it.stream_id),
    titulo: it.name,
    categoriaId: 'filmes',
    stream: `${base}/movie/${user}/${pass}/${it.stream_id}.mp4`,
    formato: 'mp4',
    imagem: it.stream_icon || 'https://via.placeholder.com/300x450.png?text=Filme'
  }));
}

async function obterSeriesXtream(base, user, pass) {
  base = base.endsWith('/') ? base.slice(0, -1) : base;
  const api = `${base}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
  const series = await xtGet(`${api}&action=get_series`);
  return (series || []).map(it => ({
    id: String(it.series_id),
    titulo: it.name,
    categoriaId: 'series',
    stream: `${base}/series/${user}/${pass}/${it.series_id}.m3u8`,
    formato: 'hls',
    imagem: it.cover || 'https://via.placeholder.com/300x450.png?text=Serie'
  }));
}

async function xtGet(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch (err) {
    // Fallback via proxy para evitar CORS
    const proxied = await fetchWithProxy(url);
    return proxied ? (await proxied.json().catch(() => null)) : null;
  }
}

async function obterDadosM3U(url) {
  let r;
  try {
    r = await fetch(url);
    if (!r.ok) return null;
  } catch (err) {
    r = await fetchWithProxy(url);
    if (!r || !r.ok) return null;
  }
  const txt = await r.text();
  return parseM3U(txt);
}

// Tenta via fetch direto, se falhar usa proxy local (http://localhost:8081)
async function fetchWithProxy(url) {
  const proxyUrl = `http://localhost:8081/proxy?url=${encodeURIComponent(url)}`;
  try {
    return await fetch(proxyUrl);
  } catch (e) {
    return null;
  }
}

function parseM3U(txt) {
  const lines = txt.split(/\r?\n/);
  const categorias = [
    { id: 'ao_vivo', nome: 'TV Ao Vivo' },
    { id: 'filmes', nome: 'Filmes' },
    { id: 'series', nome: 'Séries' }
  ];
  const canais = []; const conteudos = [];
  let meta = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      meta = line;
    } else if (!line.startsWith('#') && meta) {
      const url = line;
      const title = meta.split(',').slice(1).join(',').trim();
      const group = attr(meta, 'group-title');
      const logo = attr(meta, 'tvg-logo') || 'https://via.placeholder.com/300x450.png?text=Canal';
      const isVod = /vod/i.test(group || '') || /\.mp4$/i.test(url);
      const isSeries = /serie|séries/i.test(group || '');
      const obj = {
        id: String(i),
        titulo: title,
        stream: url,
        formato: /\.m3u8$/i.test(url) ? 'hls' : 'mp4',
        imagem: logo
      };
      if (isVod) { obj.categoriaId = 'filmes'; conteudos.push(obj); }
      else if (isSeries) { obj.categoriaId = 'series'; conteudos.push(obj); }
      else { obj.categoriaId = 'ao_vivo'; canais.push(obj); }
      meta = null;
    }
  }
  const dados = { categorias, canais, conteudos };
  dados.flags = { filmesLoaded: true, seriesLoaded: true, origem: 'm3u' };
  return dados;
}

function attr(meta, key) {
  const m = meta.match(new RegExp(`${key}="([^"]+)"`));
  return m ? m[1] : null;
}

// Carrega VOD/Séries sob demanda quando usando Xtream
async function carregarCategoriaSeNecessario(catId) {
  const flags = state.dados.flags || {};
  if (flags.origem !== 'xtream') return; // M3U e Mock já estão completos
  const { base, user, pass } = state.dados.xt;
  if (catId === 'filmes' && !flags.filmesLoaded) {
    el.status.textContent = 'Carregando filmes...';
    const filmes = await obterVodXtream(base, user, pass);
    state.dados.conteudos = [...state.dados.conteudos, ...filmes];
    flags.filmesLoaded = true;
    el.status.textContent = 'Pronto';
  }
  if (catId === 'series' && !flags.seriesLoaded) {
    el.status.textContent = 'Carregando séries...';
    const series = await obterSeriesXtream(base, user, pass);
    state.dados.conteudos = [...state.dados.conteudos, ...series];
    flags.seriesLoaded = true;
    el.status.textContent = 'Pronto';
  }
}
