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

        // During search, allow no category (search will be global)
        if (!selectedCategory && !isSearching) {
          const fallback = pickDefaultCategory(cats);
          if (fallback) {
            updateParams({ category: fallback }, { replace: true });
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
  }, [contentRefreshNonce, isSearching]);

  useEffect(() => {
    let cancelled = false;
    const loadChannels = async () => {
      try {
        const q = normalizeText(query);
        const isSearching = q.length >= 2;

        // When searching, search across ALL live channels (ignore category) for better UX.
        if (!selectedCategory && !isSearching) return;
        setLoading(true);

        const cacheKey = isSearching ? '__search_all__' : String(selectedCategory);
        const desiredLimit = isSearching ? 2000 : (String(selectedCategory) === 'all' ? 300 : 100);

        const cachedEntry = channelsCacheRef.current.get(cacheKey);
        const cachedList = Array.isArray(cachedEntry?.list) ? cachedEntry.list : (Array.isArray(cachedEntry) ? cachedEntry : null);
        const cachedLimit = Number.isFinite(Number(cachedEntry?.limit)) ? Number(cachedEntry.limit) : (cachedList ? cachedList.length : 0);

        if (cachedList && cachedList.length > 0 && cachedLimit >= desiredLimit) {
          setChannels(cachedList);
          setLoading(false);
          return;
        }

        const isAll = String(selectedCategory) === 'all';
        const channelsRes = await channelsAPI.getAll({
          ...(isSearching ? {} : (isAll ? {} : { category: selectedCategory })),
          limit: desiredLimit,
        });
        if (cancelled) return;

        const list = channelsRes?.channels || [];
        channelsCacheRef.current.set(cacheKey, { list, limit: desiredLimit });

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
  }, [selectedCategory, query, contentRefreshNonce]);

  const handleCategoryChange = (categoryId) => {
    if (categoryId) updateParams({ category: categoryId });
    else updateParams({ category: null });
    setActiveCategory(categoryId);
  };

  const filteredChannels = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return channels;
    return (channels || []).filter((c) => normalizeText(c?.name || c?.title || '').includes(q));
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
          <span className="text-gray-500"> (buscando em todos os canais)</span>
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
