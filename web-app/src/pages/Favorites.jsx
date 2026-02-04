import { useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import ContentGrid from '@components/ContentGrid';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';
import useFavoritesStore from '@store/favoritesStore';

export default function Favorites() {
  const [filter, setFilter] = useState('all');
  const { list, clear } = useFavoritesStore();

  const favorites = list?.() || [];
  const filtered = useMemo(() => {
    if (filter === 'all') return favorites;
    return favorites.filter((f) => String(f?.type || '').toLowerCase() === filter);
  }, [favorites, filter]);

  const handleClear = () => {
    try {
      if (favorites.length === 0) return;
      const ok = window.confirm('Deseja remover todos os favoritos?');
      if (!ok) return;
      clear?.();
      toast.success('Favoritos limpos');
    } catch (error) {
      logger.error('pages.favorites.clear_failed', undefined, error);
      toast.error('Erro ao limpar favoritos');
    }
  };

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

      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'movie', label: 'Filmes' },
            { key: 'series', label: 'Séries' },
            { key: 'live', label: 'Canais' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={
                'px-3 py-2 rounded-lg text-sm font-semibold transition ' +
                (filter === t.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-gray-200 hover:bg-dark-700')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="md:ml-auto">
          <button
            type="button"
            onClick={handleClear}
            disabled={favorites.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-dark-800 text-gray-200 hover:bg-dark-700 disabled:opacity-50 transition"
          >
            Limpar favoritos
          </button>
        </div>
      </div>

      {filtered.length > 0 ? (
        <ContentGrid items={filtered} type="mixed" />
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">💔</div>
          <p className="text-xl text-gray-400">Nenhum favorito ainda</p>
          <p className="text-gray-500 mt-2">Marque filmes, séries e canais para ver aqui.</p>
        </div>
      )}
    </div>
  );
}
