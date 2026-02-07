import { useMemo, useRef, useState, useEffect } from 'react';
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
  const query = String(searchParams.get('q') || '').trim();
  const isSearching = query.length > 0;
  const { setActiveCategory, categoriesCache, updateCategoriesCache, contentRefreshNonce } = useAppStore();

  const normalizeText = (value) => {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const updateParams = (updates, options) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || String(value) === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, options);
  };

  useEffect(() => {
    moviesCacheRef.current.clear();
    setMovies([]);
    setLoading(true);
  }, [contentRefreshNonce]);

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
        const searchingAll = normalizeText(query).length >= 2;
        const cachedCats = Array.isArray(categoriesCache?.vod) ? categoriesCache.vod : null;

        const cats = cachedCats?.length
          ? cachedCats
          : (await categoriesAPI.getAll({ type: 'vod' }))?.categories || [];

        if (cancelled) return;

        setCategories(cats);
        if (!cachedCats?.length) updateCategoriesCache?.('vod', cats);

        // Evitar carregar o catálogo inteiro (sem categoria) porque é lento em muitos provedores.
        // Porém, durante busca (q), permitimos "sem categoria" para busca geral.
        if (!selectedCategory && !searchingAll) {
          const fallback = pickDefaultCategory(cats);
          if (fallback) {
            updateParams({ category: fallback }, { replace: true });
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
  }, [contentRefreshNonce, query, selectedCategory]);

  useEffect(() => {
    let cancelled = false;
    const loadMovies = async () => {
      try {
        const qRaw = String(query || '').trim();
        const q = normalizeText(qRaw);
        const searchingAll = q.length >= 2;

        if (!selectedCategory && !searchingAll) return;
        setLoading(true);

        const cacheKey = searchingAll ? `__search__:${q}` : String(selectedCategory);
        const desiredLimit = searchingAll ? 300 : (String(selectedCategory) === 'all' ? 300 : 100);

        const cachedEntry = moviesCacheRef.current.get(cacheKey);
        const cachedList = Array.isArray(cachedEntry?.list)
          ? cachedEntry.list
          : (Array.isArray(cachedEntry) ? cachedEntry : null);
        const cachedLimit = Number.isFinite(Number(cachedEntry?.limit))
          ? Number(cachedEntry.limit)
          : (cachedList ? cachedList.length : 0);

        if (cachedList && cachedList.length > 0 && cachedLimit >= desiredLimit) {
          setMovies(cachedList);
          setLoading(false);
          return;
        }

        const isAll = String(selectedCategory) === 'all';
        const moviesRes = await contentAPI.getAll({
          type: 'movie',
          ...(searchingAll ? { q: qRaw } : (isAll ? {} : { category: selectedCategory })),
          limit: desiredLimit,
        });
        if (cancelled) return;

        const list = moviesRes?.contents || [];
        moviesCacheRef.current.set(cacheKey, { list, limit: desiredLimit });

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
  }, [selectedCategory, query, contentRefreshNonce]);

  const handleCategoryChange = (categoryId) => {
    if (categoryId) updateParams({ category: categoryId });
    else updateParams({ category: null });
    setActiveCategory(categoryId);
  };

  const filteredMovies = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return movies;
    return (movies || []).filter((m) => normalizeText(m?.title || m?.name || '').includes(q));
  }, [movies, query]);

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

      {isSearching ? null : (
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {query ? (
        <div className="mb-4 text-sm text-gray-400">
          Resultados para: <span className="text-white font-semibold">"{query}"</span>
          <span className="text-gray-500"> (buscando em todo o catálogo)</span>
        </div>
      ) : null}

      <ContentGrid
        items={filteredMovies}
        type="movie"
        emptyMessage={query ? `Nenhum filme encontrado para "${query}"` : 'Nenhum filme encontrado'}
      />
    </div>
  );
}
