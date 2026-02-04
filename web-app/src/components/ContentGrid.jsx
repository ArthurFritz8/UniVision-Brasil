import { useNavigate } from 'react-router-dom';
import { Play, Star, Clock, Heart } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useAuthStore from '@store/authStore';
import useFavoritesStore from '@store/favoritesStore';
import SeriesModal from './SeriesModal';
import MovieModal from './MovieModal';
import { logger } from '@/utils/logger';

export default function ContentGrid({ items, type, emptyMessage }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { isFavorite, toggle } = useFavoritesStore();
  const [imageErrors, setImageErrors] = useState({});
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);

  const getItemKind = (item) => {
    const inferred =
      type === 'mixed'
        ? String(item?.type || '').toLowerCase()
        : String(type || '').toLowerCase();

    if (inferred === 'content') return 'movie';
    if (inferred === 'channel') return 'live';
    return inferred || 'movie';
  };

  const PAGE_SIZE = 48;
  const [visibleCount, setVisibleCount] = useState(() => {
    const len = Array.isArray(items) ? items.length : 0;
    return Math.min(PAGE_SIZE, len);
  });
  const sentinelRef = useRef(null);

  const playNow = (item, itemKind, e) => {
    e?.stopPropagation?.();

    // Series needs episode selection
    if (itemKind === 'series') {
      setSelectedSeries(item);
      return;
    }

    if (itemKind === 'movie') {
      sessionStorage.setItem(
        'currentItem',
        JSON.stringify({
          id: item._id,
          type: 'movie',
          streamUrl: item.streamUrl,
          title: item.title,
          logo: item.poster || item.logo,
        })
      );
      navigate(`/player/content/${item._id}`);
      return;
    }

    // Channel/live
    sessionStorage.setItem(
      'currentItem',
      JSON.stringify({
        id: item._id,
        type: 'live',
        streamUrl: item.streamUrl,
        title: item.title,
        logo: item.poster || item.logo,
      })
    );
    navigate(`/player/channel/${item._id}`);
  };

  const openDetails = (item, e) => {
    e?.stopPropagation?.();

    const inferred =
      type === 'mixed'
        ? String(item?.type || '').toLowerCase()
        : String(type || '').toLowerCase();

    if (inferred === 'series') {
      setSelectedSeries(item);
      return;
    }

    if (inferred === 'movie' || inferred === 'content') {
      setSelectedMovie(item);
      return;
    }

    // Channels: keep the fast path
    playNow(item, 'channel', e);
  };

  const handleImageError = (itemId) => {
    setImageErrors(prev => ({ ...prev, [itemId]: true }));
  };

  const getPlaceholderImage = (title) => {
    // Local (offline) placeholder to avoid DNS/CORS issues with external placeholder services.
    const safe = String(title || '').slice(0, 40);
    const bg = '#1e293b';
    const fg = '#94a3b8';
    const accent = '#0ea5e9';
    const w = type === 'channel' ? 640 : 300;
    const h = type === 'channel' ? 360 : 450;
    const label = type === 'channel' ? 'Canal' : 'Conteúdo';

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

  useEffect(() => {
    // Reset paging when the list changes (category/search).
    const len = Array.isArray(items) ? items.length : 0;
    setVisibleCount(Math.min(PAGE_SIZE, len));
  }, [items]);

  useEffect(() => {
    if (!items || items.length === 0) {
      logger.trace('components.contentGrid.empty', { type });
      return;
    }
    logger.trace('components.contentGrid.render', { type, count: items.length });
  }, [type, items?.length]);

  const hasMore = Array.isArray(items) && visibleCount < items.length;
  const visibleItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => {
            const len = Array.isArray(items) ? items.length : 0;
            return Math.min(c + PAGE_SIZE, len);
          });
        }
      },
      { rootMargin: '800px' }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, items]);

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-6xl mb-4">📺</div>
        <p className="text-xl text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid-responsive">
      {visibleItems.map((item) => (
        (() => {
          const itemKind = getItemKind(item);
          const fav = isFavorite?.(item?._id, itemKind);

          return (
        <div
          key={item._id}
          className="group relative bg-dark-900 rounded-lg overflow-hidden card-hover cursor-pointer"
          onClick={(e) => openDetails(item, e)}
        >
          {/* Thumbnail */}
          <div
            className={`relative ${type === 'channel' ? 'aspect-video' : 'aspect-[2/3]'} bg-dark-800 flex items-center justify-center`}
          >
            {imageErrors[item._id] ? (
              // Fallback quando imagem não carrega
              <div className="w-full h-full bg-gradient-to-br from-dark-700 to-dark-800 flex flex-col items-center justify-center p-4">
                <div className="text-4xl mb-2">{type === 'channel' ? '📡' : '🎬'}</div>
                <p className="text-center text-gray-500 text-xs truncate">{item.title}</p>
              </div>
            ) : (
              <img
                src={
                  type === 'channel'
                    ? (item.logo || item.poster || item.thumbnail || getPlaceholderImage(item.title))
                    : (item.poster || item.thumbnail || getPlaceholderImage(item.title))
                }
                alt={item.title}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => handleImageError(item._id)}
                className={
                  type === 'channel'
                    ? 'w-full h-full object-contain p-4'
                    : 'w-full h-full object-cover'
                }
              />
            )}
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
              <div className="p-4 w-full">
                <button
                  type="button"
                  onClick={(e) => {
                    const inferred =
                      type === 'mixed'
                        ? String(item?.type || '').toLowerCase()
                        : String(type || '').toLowerCase();

                    if (inferred === 'series') return openDetails(item, e);
                    if (inferred === 'movie' || inferred === 'content') return playNow(item, 'movie', e);
                    return playNow(item, 'channel', e);
                  }}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Play size={18} />
                  <span>Assistir</span>
                </button>
              </div>
            </div>

            {/* Favorite button */}
            {isAuthenticated && (
              <button
                type="button"
                aria-label={fav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                title={fav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle?.({ ...item, type: itemKind });
                }}
                className={
                  'absolute bottom-3 right-3 p-2 rounded-lg backdrop-blur bg-black/45 hover:bg-black/60 transition '
                  + (fav ? 'text-red-500' : 'text-gray-200')
                }
              >
                <Heart size={18} className={fav ? 'fill-red-500' : ''} />
              </button>
            )}

            {/* Premium badge */}
            {item.isPremium && (
              <div className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold">
                PREMIUM
              </div>
            )}

            {/* Quality badge */}
            {item.quality && (
              <div className="absolute top-2 left-2 bg-primary-600 px-2 py-1 rounded text-xs font-bold">
                {item.quality}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3">
            <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary-400 transition-colors">
              {item.title}
            </h3>
            
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {item.metadata?.rating?.imdb && (
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-500" />
                  <span>{item.metadata.rating.imdb}</span>
                </div>
              )}
              
              {item.year && (
                <span>{item.year}</span>
              )}
              
              {item.duration && (
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>{item.duration}min</span>
                </div>
              )}
              
              {item.metadata?.views && (
                <span>{item.metadata.views.toLocaleString()} views</span>
              )}
            </div>

            {/* Genre tags */}
            {item.metadata?.genre && item.metadata.genre.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {item.metadata.genre.slice(0, 2).map((genre, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-dark-800 px-2 py-0.5 rounded text-gray-400"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
          );
        })()
      ))}

      {hasMore && (
        <div ref={sentinelRef} className="col-span-full h-8" aria-hidden="true" />
      )}
      
      {/* Series Modal */}
      {selectedSeries && (
        <SeriesModal 
          series={selectedSeries} 
          onClose={() => setSelectedSeries(null)}
        />
      )}

      {/* Movie Modal */}
      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
}
