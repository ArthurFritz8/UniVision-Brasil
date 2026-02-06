import { useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { channelsAPI, categoriesAPI } from '@services/api';
import useAppStore from '@store/appStore';
import ContentGrid from '@components/ContentGrid';
import CategoryFilter from '@components/CategoryFilter';
import Loading from '@components/Loading';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

export default function Live() {
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const channelsCacheRef = useRef(new Map());
  
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
    // Clear page-level cache so next loads pull fresh data
    channelsCacheRef.current.clear();
    setChannels([]);
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
        const cachedCats = Array.isArray(categoriesCache?.live) ? categoriesCache.live : null;

        const cats = cachedCats?.length
          ? cachedCats
          : (await categoriesAPI.getAll({ type: 'live' }))?.categories || [];

        if (cancelled) return;

        setCategories(cats);
        if (!cachedCats?.length) updateCategoriesCache?.('live', cats);

        if (!selectedCategory) {
          const fallback = pickDefaultCategory(cats);
          if (fallback) {
            setSearchParams({ category: fallback }, { replace: true });
            setActiveCategory(fallback);
            return;
          }
        }

        setLoading(false);
      } catch (error) {
        logger.error('pages.live.categories_load_failed', undefined, error);
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
    const loadChannels = async () => {
      try {
        if (!selectedCategory) return;
        setLoading(true);

        const cached = channelsCacheRef.current.get(String(selectedCategory));
        if (cached) {
          setChannels(cached);
          setLoading(false);
          return;
        }

        const isAll = String(selectedCategory) === 'all';
        const channelsRes = await channelsAPI.getAll({
          ...(isAll ? {} : { category: selectedCategory }),
          limit: isAll ? 300 : 100,
        });
        if (cancelled) return;

        const list = channelsRes?.channels || [];
        channelsCacheRef.current.set(String(selectedCategory), list);

        logger.debug('pages.live.data_loaded', {
          channels: list.length,
          selectedCategory,
        });
        setChannels(list);
      } catch (error) {
        logger.error('pages.live.load_failed', { selectedCategory }, error);
        toast.error('Erro ao carregar canais');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadChannels();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, contentRefreshNonce]);

  const handleCategoryChange = (categoryId) => {
    if (categoryId) updateParams({ category: categoryId });
    else updateParams({ category: null });
    setActiveCategory(categoryId);
  };

  const filteredChannels = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return channels;
    return (channels || []).filter((c) => String(c?.name || c?.title || '').toLowerCase().includes(q));
  }, [channels, query]);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-display mb-2 gradient-text">
          📡 TV ao Vivo
        </h1>
        <p className="text-gray-400">
          Assista seus canais favoritos
        </p>
      </div>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      {query ? (
        <div className="mb-4 text-sm text-gray-400">
          Filtrando canais por: <span className="text-white font-semibold">"{query}"</span>
        </div>
      ) : null}

      <ContentGrid
        items={filteredChannels}
        type="channel"
        emptyMessage={query ? `Nenhum canal encontrado para "${query}"` : 'Nenhum canal encontrado'}
      />
    </div>
  );
}
