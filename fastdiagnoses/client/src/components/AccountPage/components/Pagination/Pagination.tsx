import React, { useCallback } from 'react';
import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  autoScroll?: boolean;
  targetElementId?: string; // Новый пропс - ID элемента для прокрутки
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  maxVisiblePages = 5,
  autoScroll = true,
  targetElementId // ID элемента к которому нужно прокрутить
}) => {
  // Функция для прокрутки к целевому элементу
  const scrollToTarget = useCallback(() => {
    if (!autoScroll) return;
    
    setTimeout(() => {
      if (targetElementId) {
        // Пытаемся найти элемент по ID
        const targetElement = document.getElementById(targetElementId);
        
        if (targetElement) {
          // Прокручиваем к элементу
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          console.log(`📍 Прокрутка к элементу с ID: ${targetElementId}`);
        } else {
          console.warn(`⚠️ Элемент с ID "${targetElementId}" не найден`);
          // Fallback: прокрутка к верху страницы
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      } else {
        // Если ID не указан, прокручиваем к верху страницы
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, 50);
  }, [autoScroll, targetElementId]);

  // Обработчик клика с прокруткой
  const handlePageClick = useCallback((page: number) => {
    onPageChange(page);
    scrollToTarget();
  }, [onPageChange, scrollToTarget]);

  // Генерация номеров страниц
  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  // Условие рендеринга должно быть ПОСЛЕ хуков
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers();

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Показано: <strong>{(currentPage - 1) * 5 + 1}-{Math.min(currentPage * 5, totalItems)}</strong> из <strong>{totalItems}</strong>
      </div>
      
      <div className="pagination-controls">
        <button
          className="pagination-btn first"
          onClick={() => handlePageClick(1)}
          disabled={currentPage === 1}
          title="Первая страница"
        >
          <i className="fas fa-angle-double-left"></i>
        </button>

        <button
          className="pagination-btn prev"
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage === 1}
          title="Предыдущая страница"
        >
          <i className="fas fa-angle-left"></i>
        </button>

        {pageNumbers.map((page) => (
          <button
            key={page}
            className={`pagination-btn page ${currentPage === page ? 'active' : ''}`}
            onClick={() => handlePageClick(page)}
          >
            {page}
          </button>
        ))}

        <button
          className="pagination-btn next"
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Следующая страница"
        >
          <i className="fas fa-angle-right"></i>
        </button>

        <button
          className="pagination-btn last"
          onClick={() => handlePageClick(totalPages)}
          disabled={currentPage === totalPages}
          title="Последняя страница"
        >
          <i className="fas fa-angle-double-right"></i>
        </button>
      </div>

      <div className="pagination-summary">
        Страница <strong>{currentPage}</strong> из <strong>{totalPages}</strong>
      </div>
    </div>
  );
};

Pagination.displayName = 'Pagination';

export default Pagination;
export { Pagination };