import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, TrendingUp, Clock } from 'lucide-react';
import { channelsAPI, contentAPI, categoriesAPI } from '@services/api';
import useAuthStore from '@store/authStore';
import { logger } from '@/utils/logger';
import MovieModal from '@components/MovieModal';

export default function Home() {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [popularChannels, setPopularChannels] = useState([]);
  const [recentMovies, setRecentMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadHomeData();
  }, []);

  const getPlaceholderImage = (title, kind) => {
    const safe = String(title || '').slice(0, 40);
    const bg = '#1e293b';
    const fg = '#94a3b8';
    const accent = '#0ea5e9';
    const isChannel = kind === 'channel';
    const w = isChannel ? 640 : 300;
    const h = isChannel ? 360 : 450;
    const label = isChannel ? 'Canal' : 'Filme';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="${bg}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="0" y="0" width="100%" height="6" fill="${accent}" opacity="0.7"/>
  <text x="50%" y="46%" text-anchor="middle" fill="${fg}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="18" font-weight="700">${label}</text>
  <text x="50%" y="58%" text-anchor="middle" fill="#cbd5e1" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="16">${safe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
</svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const pickDefaultCategory = (cats) => {
    const list = Array.isArray(cats) ? cats : [];
    const preferred = list.find((c) => {
      const id = String(c?._id ?? '');
      const name = String(c?.name ?? '').toLowerCase();
      if (!id) return false;
      if (id === '0') return false;
      if (name.includes('all') || name.includes('todos')) return false;
      return true;
    });
    return (preferred?._id ?? list[0]?._id ?? null) || null;
  };

  const loadHomeData = async () => {
    try {
      setLoading(true);

      // Em muitos provedores Xtream, pedir listas sem categoria baixa o catálogo inteiro (lento).
      // Então pegamos categorias (rápido) e carregamos só uma categoria padrão para o Home.
      const [liveCats, vodCats] = await Promise.all([
        categoriesAPI.getAll({ type: 'live' }),
        categoriesAPI.getAll({ type: 'vod' }),
      ]);

      const liveCategory = pickDefaultCategory(liveCats?.categories);
      const vodCategory = pickDefaultCategory(vodCats?.categories);

      const [channelsRes, moviesRes] = await Promise.all([
        channelsAPI.getAll({ category: liveCategory, limit: 12 }),
        contentAPI.getAll({ type: 'movie', category: vodCategory, limit: 12 }),
      ]);

      logger.debug('pages.home.data_loaded', {
        channels: channelsRes?.channels?.length,
        movies: moviesRes?.contents?.length,
      });
      setPopularChannels(channelsRes?.channels || []);
      setRecentMovies(moviesRes?.contents || []);
    } catch (error) {
      logger.error('pages.home.load_failed', undefined, error);
      setPopularChannels([]);
      setRecentMovies([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="relative h-[500px] rounded-2xl overflow-hidden mb-12 bg-gradient-to-r from-primary-600 to-primary-800">
        <div className="absolute inset-0 flex items-center justify-center text-center p-8">
          <div className="max-w-3xl">
            <h1 className="text-6xl font-bold font-display mb-6">
              Bem-vindo ao UniVision Brasil
            </h1>
            <p className="text-xl text-gray-200 mb-8">
              Sua plataforma completa de streaming: TV ao Vivo, Filmes e Séries
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/live" className="btn-primary">
                <Play size={20} />
                <span>TV ao Vivo</span>
              </Link>
              <Link to="/movies" className="btn-secondary">
                Ver Filmes
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Canais Populares */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="text-primary-500" />
            Canais Populares
          </h2>
          <Link to="/live" className="text-primary-500 hover:text-primary-400">
            Ver todos →
          </Link>
        </div>
        <div className="grid-responsive">
          {popularChannels.slice(0, 6).map((channel) => (
            <Link
              key={channel._id}
              to={`/player/channel/${channel._id}`}
              className="card-hover"
            >
              <div className="aspect-video bg-dark-800 rounded-lg overflow-hidden">
                <img
                  src={channel.logo || channel.thumbnail || getPlaceholderImage(channel.title, 'channel')}
                  alt={channel.title}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="mt-2 font-semibold">{channel.title}</h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Filmes Recentes */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="text-primary-500" />
            Adicionados Recentemente
          </h2>
          <Link to="/movies" className="text-primary-500 hover:text-primary-400">
            Ver todos →
          </Link>
        </div>
        <div className="grid-responsive">
          {recentMovies.slice(0, 6).map((movie) => (
            <button
              key={movie._id}
              type="button"
              onClick={() => setSelectedMovie(movie)}
              className="card-hover text-left"
            >
              <div className="aspect-[2/3] bg-dark-800 rounded-lg overflow-hidden">
                <img
                  src={movie.poster || getPlaceholderImage(movie.title, 'movie')}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="mt-2 font-semibold line-clamp-2">{movie.title}</h3>
            </button>
          ))}
        </div>
      </section>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
}
