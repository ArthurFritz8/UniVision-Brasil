import { useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
      setQuery('');
      setIsFocused(false);
    }
  };

  const handleClear = () => {
    setQuery('');
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className={`relative transition-all ${isFocused ? 'scale-105' : ''}`}>
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
        
        <input
          type="text"
          placeholder="Buscar filmes, séries, canais..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full pl-10 pr-10 py-2.5 bg-dark-700 border border-dark-600 rounded-lg focus:border-primary-500 focus:outline-none transition text-sm placeholder-gray-500"
        />
        
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </form>
  );
}
