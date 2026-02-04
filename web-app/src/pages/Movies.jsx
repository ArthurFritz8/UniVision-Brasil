import { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { contentAPI, categoriesAPI } from '@services/api';
import useAppStore from '@store/appStore';
import ContentGrid from '@components/ContentGrid';
import CategoryFilter from '@components/CategoryFilter';
import Loading from '@components/Loading';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const moviesCacheRef = useRef(new Map());
  
  const selectedCategory = searchParams.get('category');
  const { setActiveCategory, categoriesCache, updateCategoriesCache } = useAppStore();

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

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const cachedCats = Array.isArray(categoriesCache?.vod) ? categoriesCache.vod : null;

        const cats = cachedCats?.length
          ? cachedCats
          : (await categoriesAPI.getAll({ type: 'vod' }))?.categories || [];

        if (cancelled) return;

        setCategories(cats);
        if (!cachedCats?.length) updateCategoriesCache?.('vod', cats);

        // Evitar carregar o catálogo inteiro (sem categoria) porque é lento em muitos provedores.
        if (!selectedCategory) {
          const fallback = pickDefaultCategory(cats);
          if (fallback) {
            setSearchParams({ category: fallback }, { replace: true });
            setActiveCategory(fallback);
            return;
          }
        }

        // Se já tem categoria selecionada ou não há fallback, libera a tela.
        setLoading(false);
      } catch (error) {
        logger.error('pages.movies.categories_load_failed', undefined, error);
        toast.error('Erro ao carregar categorias');
        setLoading(false);
      }
    };

    loadCategories();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadMovies = async () => {
      try {
        if (!selectedCategory) return;
        setLoading(true);

        const cached = moviesCacheRef.current.get(String(selectedCategory));
        if (cached) {
          setMovies(cached);
          setLoading(false);
          return;
        }

        const moviesRes = await contentAPI.getAll({
          type: 'movie',
          category: selectedCategory,
          limit: 100,
        });
        if (cancelled) return;

        const list = moviesRes?.contents || [];
        moviesCacheRef.current.set(String(selectedCategory), list);

        logger.debug('pages.movies.data_loaded', {
          movies: list.length,
          selectedCategory,
        });
        setMovies(list);
      } catch (error) {
        logger.error('pages.movies.load_failed', { selectedCategory }, error);
        toast.error('Erro ao carregar filmes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMovies();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  const handleCategoryChange = (categoryId) => {
    if (categoryId) {
      setSearchParams({ category: categoryId });
    } else {
      setSearchParams({});
    }
    setActiveCategory(categoryId);
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-display mb-2 gradient-text">
          🎬 Filmes
        </h1>
        <p className="text-gray-400">
          Descubra os melhores filmes
        </p>
      </div>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      <ContentGrid
        items={movies}
        type="movie"
        emptyMessage="Nenhum filme encontrado"
      />
    </div>
  );
}
