import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, TrendingUp, Clock } from 'lucide-react';
import { channelsAPI, contentAPI } from '@services/api';
import useAuthStore from '@store/authStore';
import { logger } from '@/utils/logger';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [popularChannels, setPopularChannels] = useState([]);
  const [recentMovies, setRecentMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      setLoading(true);
      const [channelsRes, moviesRes] = await Promise.all([
        channelsAPI.getAll({ limit: 12 }),
        contentAPI.getAll({ type: 'movie', limit: 12 })
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
                  src={channel.thumbnail || 'https://via.placeholder.com/300x200?text=Canal'}
                  alt={channel.title}
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
            <Link
              key={movie._id}
              to={`/player/content/${movie._id}`}
              className="card-hover"
            >
              <div className="aspect-[2/3] bg-dark-800 rounded-lg overflow-hidden">
                <img
                  src={movie.poster || 'https://via.placeholder.com/300x450?text=Filme'}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="mt-2 font-semibold line-clamp-2">{movie.title}</h3>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
