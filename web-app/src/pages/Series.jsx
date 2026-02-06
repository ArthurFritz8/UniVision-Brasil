import { useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { contentAPI, categoriesAPI } from '@services/api';
import useAppStore from '@store/appStore';
import ContentGrid from '@components/ContentGrid';
import CategoryFilter from '@components/CategoryFilter';
import Loading from '@components/Loading';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

export default function Series() {
  const [series, setSeries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const seriesCacheRef = useRef(new Map());
  
  const selectedCategory = searchParams.get('category');
  const query = String(searchParams.get('q') || '').trim();
  const { setActiveCategory, categoriesCache, updateCategoriesCache, contentRefreshNonce } = useAppStore();

  const updateParams = (updates, options) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || String(value) === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, options);
  };

  useEffect(() => {
    seriesCacheRef.current.clear();
    setSeries([]);
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
        const cachedCats = Array.isArray(categoriesCache?.series) ? categoriesCache.series : null;

        const cats = cachedCats?.length
          ? cachedCats
          : (await categoriesAPI.getAll({ type: 'series' }))?.categories || [];

        if (cancelled) return;

        setCategories(cats);
        if (!cachedCats?.length) updateCategoriesCache?.('series', cats);

        if (!selectedCategory) {
          const fallback = pickDefaultCategory(cats);
          if (fallback) {
            updateParams({ category: fallback }, { replace: true });
            setActiveCategory(fallback);
            return;
          }
        }

        setLoading(false);
      } catch (error) {
        logger.error('pages.series.categories_load_failed', undefined, error);
        toast.error('Erro ao carregar categorias');
        setLoading(false);
      }
    };

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [contentRefreshNonce]);

  useEffect(() => {
    let cancelled = false;
    const loadSeries = async () => {
      try {
        if (!selectedCategory) return;
        setLoading(true);

        const cached = seriesCacheRef.current.get(String(selectedCategory));
        if (cached) {
          setSeries(cached);
          setLoading(false);
          return;
        }

        const isAll = String(selectedCategory) === 'all';
        const seriesRes = await contentAPI.getAll({
          type: 'series',
          ...(isAll ? {} : { category: selectedCategory }),
          limit: isAll ? 300 : 100,
        });
        if (cancelled) return;

        const list = seriesRes?.contents || [];
        seriesCacheRef.current.set(String(selectedCategory), list);

        logger.debug('pages.series.data_loaded', {
          series: list.length,
          selectedCategory,
        });
        setSeries(list);
      } catch (error) {
        logger.error('pages.series.load_failed', { selectedCategory }, error);
        toast.error('Erro ao carregar séries');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSeries();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, contentRefreshNonce]);

  const handleCategoryChange = (categoryId) => {
    if (categoryId) updateParams({ category: categoryId });
    else updateParams({ category: null });
    setActiveCategory(categoryId);
  };

  const filteredSeries = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return series;
    return (series || []).filter((s) => String(s?.title || s?.name || '').toLowerCase().includes(q));
  }, [series, query]);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-display mb-2 gradient-text">
          📺 Séries
        </h1>
        <p className="text-gray-400">
          Maratone suas séries favoritas
        </p>
      </div>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      {query ? (
        <div className="mb-4 text-sm text-gray-400">
          Filtrando séries por: <span className="text-white font-semibold">"{query}"</span>
        </div>
      ) : null}

      <ContentGrid
        items={filteredSeries}
        type="series"
        emptyMessage={query ? `Nenhuma série encontrada para "${query}"` : 'Nenhuma série encontrada'}
      />
    </div>
  );
}
