import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { favoritesAPI } from '@services/api';
import ContentGrid from '@components/ContentGrid';
import Loading from '@components/Loading';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const response = await favoritesAPI.getAll();
      setFavorites(response.data.favorites || []);
    } catch (error) {
      logger.error('pages.favorites.load_failed', undefined, error);
      toast.error('Erro ao carregar favoritos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Carregando favoritos..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-display mb-2 flex items-center gap-3">
          <Heart size={36} className="text-red-500 fill-red-500" />
          Meus Favoritos
        </h1>
        <p className="text-gray-400">
          {favorites.length > 0 
            ? `${favorites.length} item(s) marcado(s) como favorito`
            : 'Você ainda não tem favoritos'}
        </p>
      </div>

      {favorites.length > 0 ? (
        <ContentGrid items={favorites} type="mixed" />
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">💔</div>
          <p className="text-xl text-gray-400">Nenhum favorito ainda</p>
          <p className="text-gray-500 mt-2">Comece marcando seus conteúdos favoritos!</p>
        </div>
      )}
    </div>
  );
}
