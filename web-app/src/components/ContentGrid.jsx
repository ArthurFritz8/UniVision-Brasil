import { useNavigate } from 'react-router-dom';
import { Play, Star, Clock } from 'lucide-react';
import { useState } from 'react';
import useAuthStore from '@store/authStore';
import SeriesModal from './SeriesModal';
import { logger } from '@/utils/logger';

export default function ContentGrid({ items, type, emptyMessage }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [imageErrors, setImageErrors] = useState({});
  const [selectedSeries, setSelectedSeries] = useState(null);

  const handlePlay = (item, e) => {
    e?.stopPropagation();
    
    // Se for série, abrir modal
    if (type === 'series') {
      setSelectedSeries(item);
      return;
    }
    
    // Salvar informações do item no sessionStorage para o player recuperar
    sessionStorage.setItem('currentItem', JSON.stringify({
      id: item._id,
      type: type === 'channel' ? 'live' : type,
      streamUrl: item.streamUrl,
      title: item.title,
      logo: item.poster || item.logo,
    }));
    
    const itemType = type === 'channel' ? 'channel' : 'content';
    navigate(`/player/${itemType}/${item._id}`);
  };

  const handleImageError = (itemId) => {
    setImageErrors(prev => ({ ...prev, [itemId]: true }));
  };

  const getPlaceholderImage = (title) => {
    return `https://via.placeholder.com/300x450/1e293b/0ea5e9?text=${encodeURIComponent(title)}`;
  };

  if (!items || items.length === 0) {
    logger.trace('components.contentGrid.empty', { type });
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-6xl mb-4">📺</div>
        <p className="text-xl text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  logger.trace('components.contentGrid.render', { type, count: items.length });

  return (
    <div className="grid-responsive">
      {items.map((item) => (
        <div
          key={item._id}
          className="group relative bg-dark-900 rounded-lg overflow-hidden card-hover cursor-pointer"
          onClick={() => handlePlay(item)}
        >
          {/* Thumbnail */}
          <div className="relative aspect-[2/3] bg-dark-800 flex items-center justify-center">
            {imageErrors[item._id] ? (
              // Fallback quando imagem não carrega
              <div className="w-full h-full bg-gradient-to-br from-dark-700 to-dark-800 flex flex-col items-center justify-center p-4">
                <div className="text-4xl mb-2">🎬</div>
                <p className="text-center text-gray-500 text-xs truncate">{item.title}</p>
              </div>
            ) : (
              <img
                src={item.poster || item.thumbnail}
                alt={item.title}
                loading="lazy"
                onError={() => handleImageError(item._id)}
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
              <div className="p-4 w-full">
                <button className="btn-primary w-full flex items-center justify-center gap-2">
                  <Play size={18} />
                  <span>Assistir</span>
                </button>
              </div>
            </div>

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
      ))}
      
      {/* Series Modal */}
      {selectedSeries && (
        <SeriesModal 
          series={selectedSeries} 
          onClose={() => setSelectedSeries(null)}
        />
      )}
    </div>
  );
}
