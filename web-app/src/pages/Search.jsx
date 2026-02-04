import { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { searchAPI } from '@services/api';
import ContentGrid from '@components/ContentGrid';
import Loading from '@components/Loading';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

export default function Search() {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const query = searchParams.get('q') || '';
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = String(query || '').trim();

    if (!q) {
      setResults([]);
      setMovies([]);
      setSeries([]);
      return;
    }

    // Debounce para não disparar busca a cada navegação/tecla
    const seq = ++requestSeq.current;
    const t = setTimeout(() => {
      handleSearch(q, seq);
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  const handleSearch = async (q, seq) => {
    try {
      if (String(q).length < 2) {
        setResults([]);
        setMovies([]);
        setSeries([]);
        return;
      }

      setLoading(true);
      const response = await searchAPI.search({ query: q, limit: 50 });
      if (seq !== requestSeq.current) return;
      const allResults = response?.results || [];
      
      // Separar por tipo
      const movieResults = allResults.filter(r => r.type === 'movie');
      const seriesResults = allResults.filter(r => r.type === 'series');
      
      setMovies(movieResults);
      setSeries(seriesResults);
      setResults(allResults);
      
      if (allResults.length === 0) {
        // Evitar spam de toast; mantém a UI de "nenhum resultado".
        toast('Nenhum resultado encontrado', { icon: '🔍' });
      }
    } catch (error) {
      if (seq !== requestSeq.current) return;
      logger.error('pages.search.failed', { query: q }, error);
      toast.error('Erro ao buscar');
      setResults([]);
      setMovies([]);
      setSeries([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Buscando..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-display mb-2 flex items-center gap-3">
          <SearchIcon size={36} className="text-primary-500" />
          Resultados da busca
        </h1>
        {query && (
          <p className="text-gray-400">
            Buscando por: <span className="text-white font-semibold">"{query}"</span>
            {results.length > 0 && ` - ${results.length} resultado(s) encontrado(s)`}
          </p>
        )}
      </div>

      {results.length > 0 ? (
        <div className="space-y-12">
          {movies.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                🎬 Filmes <span className="text-sm text-gray-400">({movies.length})</span>
              </h2>
              <ContentGrid items={movies} type="movie" emptyMessage="Nenhum filme encontrado" />
            </div>
          )}
          
          {series.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                📺 Séries <span className="text-sm text-gray-400">({series.length})</span>
              </h2>
              <ContentGrid items={series} type="series" emptyMessage="Nenhuma série encontrada" />
            </div>
          )}
        </div>
      ) : query ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-xl text-gray-400">Nenhum resultado encontrado</p>
          <p className="text-gray-500 mt-2">Tente buscar com outros termos</p>
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔎</div>
          <p className="text-xl text-gray-400">Digite algo para buscar</p>
        </div>
      )}
    </div>
  );
}
