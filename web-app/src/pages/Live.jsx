import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { channelsAPI, categoriesAPI } from '@services/api';
import useAppStore from '@store/appStore';
import ContentGrid from '@components/ContentGrid';
import CategoryFilter from '@components/CategoryFilter';
import Loading from '@components/Loading';
import toast from 'react-hot-toast';

export default function Live() {
  const [channels, setChannels] = useState([]);
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

      // Carrega categorias e canais em paralelo
      const [categoriesRes, channelsRes] = await Promise.all([
        categoriesAPI.getAll({ type: 'live' }),
        channelsAPI.getAll({ 
          category: selectedCategory,
          limit: 100 
        })
      ]);

      console.log('📺 Dados recebidos:', { categoriesRes, channelsRes });
      setCategories(categoriesRes?.categories || []);
      setChannels(channelsRes?.channels || []);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
      toast.error('Erro ao carregar canais');
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

      <ContentGrid
        items={channels}
        type="channel"
        emptyMessage="Nenhum canal encontrado"
      />
    </div>
  );
}
