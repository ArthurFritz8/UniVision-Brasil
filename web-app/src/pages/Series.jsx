import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { contentAPI, categoriesAPI } from '@services/api';
import useAppStore from '@store/appStore';
import ContentGrid from '@components/ContentGrid';
import CategoryFilter from '@components/CategoryFilter';
import Loading from '@components/Loading';
import toast from 'react-hot-toast';

export default function Series() {
  const [series, setSeries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const selectedCategory = searchParams.get('category');
  const { setActiveCategory } = useAppStore();

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carrega categorias e séries em paralelo
      const [categoriesRes, seriesRes] = await Promise.all([
        categoriesAPI.getAll({ type: 'series' }),
        contentAPI.getAll({ 
          type: 'series',
          category: selectedCategory,
          limit: 100 
        })
      ]);

      console.log('📺 Dados recebidos:', { categoriesRes, seriesRes });
      setCategories(categoriesRes?.categories || []);
      setSeries(seriesRes?.contents || []);
    } catch (error) {
      console.error('Erro ao carregar séries:', error);
      toast.error('Erro ao carregar séries');
    } finally {
      setLoading(false);
    }
  };

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

      <ContentGrid
        items={series}
        type="series"
        emptyMessage="Nenhuma série encontrada"
      />
    </div>
  );
}
