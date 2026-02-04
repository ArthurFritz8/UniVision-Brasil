import { useEffect, useMemo, useState } from 'react';
import { X, Play, Star, Clock, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

export default function MovieModal({ movie, onClose }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const description = String(movie?.description || '').trim();
  const hasLongDescription = description.length > 180;

  const yearLabel = useMemo(() => {
    const y = movie?.year;
    if (!y) return null;
    return String(y);
  }, [movie?.year]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handlePlay = () => {
    try {
      if (!movie?._id || !movie?.streamUrl) {
        toast.error('Stream indisponível');
        return;
      }

      sessionStorage.setItem(
        'currentItem',
        JSON.stringify({
          id: movie._id,
          type: 'movie',
          streamUrl: movie.streamUrl,
          title: movie.title,
          logo: movie.poster,
        })
      );

      logger.debug('movieModal.play', { id: movie?._id, title: movie?.title });
      navigate(`/player/content/${movie._id}`);
      onClose?.();
    } catch (error) {
      logger.error('movieModal.play_failed', { id: movie?._id }, error);
      toast.error('Erro ao iniciar reprodução');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="bg-dark-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-b from-dark-800 to-transparent p-6 flex items-start justify-between border-b border-dark-700">
          <div className="flex-1 pr-4">
            <h2 className="text-2xl font-bold mb-2">{movie?.title}</h2>

            {description ? (
              <div className="text-gray-400">
                <p className={expanded ? '' : 'line-clamp-2'}>{description}</p>
                {hasLongDescription && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2 text-primary-400 hover:text-primary-300 text-sm font-semibold"
                  >
                    {expanded ? 'Ver menos' : 'Ver mais'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Sem sinopse disponível.</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="ml-2 p-2 hover:bg-dark-700 rounded-lg transition"
            aria-label="Fechar"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-64 flex-shrink-0">
              <div className="aspect-[2/3] bg-dark-900 rounded-lg overflow-hidden">
                {movie?.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    🎬
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-5">
                {yearLabel && (
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-primary-400" />
                    <span>{yearLabel}</span>
                  </div>
                )}

                {movie?.duration && (
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-primary-400" />
                    <span>{movie.duration}min</span>
                  </div>
                )}

                {(movie?.metadata?.rating?.imdb || movie?.rating) && (
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-yellow-500 fill-yellow-500" />
                    <span>{movie?.metadata?.rating?.imdb || movie?.rating}</span>
                  </div>
                )}
              </div>

              {Array.isArray(movie?.metadata?.genre) && movie.metadata.genre.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {movie.metadata.genre.slice(0, 6).map((g, idx) => (
                    <span
                      key={`${g}-${idx}`}
                      className="text-xs bg-dark-700 px-3 py-1 rounded-full text-gray-200"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePlay}
                  className="btn-primary flex items-center justify-center gap-2 px-6"
                >
                  <Play size={18} />
                  <span>Assistir</span>
                </button>

                {movie?.isPremium && (
                  <div className="flex items-center text-xs font-bold bg-yellow-500 text-black px-3 py-2 rounded">
                    PREMIUM
                  </div>
                )}
              </div>

              {movie?.category && (
                <div className="mt-6 text-sm text-gray-400">
                  Categoria: <span className="text-gray-200">{movie.category}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
