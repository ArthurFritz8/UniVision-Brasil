import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CategoryFilter({ categories = [], selectedCategory, onCategoryChange }) {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  useEffect(() => {
    updateArrowVisibility();
  }, [categories]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      if (direction === 'left') {
        scrollRef.current.scrollLeft -= scrollAmount;
      } else {
        scrollRef.current.scrollLeft += scrollAmount;
      }
      setTimeout(updateArrowVisibility, 100);
    }
  };

  const updateArrowVisibility = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const handleScroll = () => {
    updateArrowVisibility();
  };

  // Fallback seguro para categorias vazias
  const categoryList = Array.isArray(categories) ? categories : [];

  return (
    <div className="mb-8">
      <div className="relative flex items-center gap-3">
        {/* Botão esquerda */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="flex-shrink-0 p-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition text-primary-500 z-10"
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* Container de categorias */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto scrollbar-hide"
          onScroll={handleScroll}
        >
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => onCategoryChange(null)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-smooth ${
                !selectedCategory
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
              }`}
            >
              Todos
            </button>
            
            {categoryList.map((category) => (
              <button
                key={category._id || category.id}
                onClick={() => onCategoryChange(category._id || category.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-smooth ${
                  selectedCategory === (category._id || category.id)
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Botão direita */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="flex-shrink-0 p-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition text-primary-500 z-10"
            aria-label="Scroll right"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
