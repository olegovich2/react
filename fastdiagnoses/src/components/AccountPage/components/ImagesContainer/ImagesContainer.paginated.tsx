// src/components/AccountPage/components/ImagesContainer/ImagesContainer.paginated.tsx
import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useAccountContext } from '../../context/AccountContext';
import { 
  getPaginatedImages,
  deleteImage, 
} from '../../../../api/images.api';
import ImageUpload from '../ImageUpload/ImageUpload';
import ImageGallery from '../ImageGallery/ImageGallery';
import Pagination from '../Pagination/Pagination';
import './ImagesContainer.css';

const ImagesContainerPaginated: React.FC = React.memo(() => {
  const {
    images,
    setImages,
    setIsLoading,
    isLoading
  } = useAccountContext();

  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 5,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Загрузка изображений с пагинацией
  const loadImages = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`📥 Загрузка изображений, страница ${page}...`);
      
      const result = await getPaginatedImages({
        page,
        limit: pagination.itemsPerPage
      });
      
      if (result.success && result.data) {
        console.log(`✅ Успешно загружено ${result.data.images?.length || 0} изображений`);
        
        // Обновляем изображения и пагинацию
        setImages(result.data.images || []);
        setCurrentPage(page);
        
        if (result.data.pagination) {
          setPagination(prev => ({
            ...prev,
            ...result.data!.pagination,
            currentPage: page
          }));
        }
        
        console.log(`📊 Пагинация: страница ${page} из ${result.data.pagination?.totalPages || 1}`);
      } else {
        setError(result.message || 'Не удалось загрузить изображения');
        console.error('❌ Ошибка загрузки изображений:', result.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Ошибка соединения с сервером';
      setError(errorMessage);
      console.error('❌ Ошибка загрузки изображений:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setImages, setIsLoading, pagination.itemsPerPage]);

  // Обработчик смены страницы
  const handlePageChange = useCallback((page: number) => {
    console.log(`🔄 Переход на страницу ${page}`);
    loadImages(page);
  }, [loadImages]);

  // Прокрутка к галерее после смены страницы
  const scrollToGallery = useCallback(() => {
    const gallery = document.querySelector('.allDownloadImages');
    if (gallery) {
      gallery.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, []);

  // Удаление изображения
  const handleDeleteImage = useCallback(async (imageId: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить это изображение?')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await deleteImage(imageId);
      if (result.success) {
        console.log(`✅ Изображение ${imageId} успешно удалено`);
        
        // Перезагружаем текущую страницу
        loadImages(currentPage);
      } else {
        setError(result.message || 'Ошибка удаления изображения');
        console.error('❌ Ошибка удаления:', result.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Ошибка соединения при удалении';
      setError(errorMessage);
      console.error('❌ Ошибка удаления изображения:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, loadImages, currentPage]);

  // Просмотр изображения
  const handleViewImage = useCallback((imageId: number) => {
    window.location.href = `/account/images/${imageId}`;
  }, []);

  // Загрузка нового изображения
  const handleImageUploadSuccess = useCallback(() => {
    console.log('🔄 Обновление списка изображений после загрузки...');
    // После загрузки нового изображения возвращаемся на первую страницу
    loadImages(1);
  }, [loadImages]);

  // Первоначальная загрузка
  useEffect(() => {
    loadImages(1);
  }, [loadImages]);

  // Мемоизируем галерею изображений
  const imageGallery = useMemo(() => (
    <ImageGallery
      images={images}
      onView={handleViewImage}
      onDelete={handleDeleteImage}
    />
  ), [images, handleViewImage, handleDeleteImage]);

  // Мемоизируем пагинацию
  const paginationComponent = useMemo(() => (
    <Pagination
      currentPage={currentPage}
      totalPages={pagination.totalPages}
      totalItems={pagination.totalItems}
      onPageChange={handlePageChange}
      scrollToElement={scrollToGallery}
      autoScroll={true}
    />
  ), [currentPage, pagination, handlePageChange, scrollToGallery]);

  // Отображение статуса загрузки
  const renderLoading = useMemo(() => {
    if (!isLoading) return null;
    
    return (
      <div className="loading-overlay">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin fa-2x"></i>
          <p>Загрузка изображений...</p>
        </div>
      </div>
    );
  }, [isLoading]);

  // Отображение ошибки
  const renderError = useMemo(() => {
    if (!error) return null;
    
    return (
      <div className="error-message">
        <i className="fas fa-exclamation-triangle"></i>
        <p>{error}</p>
        <div className="error-actions">
          <button 
            className="buttonFromTemplate error-close"
            onClick={() => setError(null)}
          >
            <i className="fas fa-times"></i> Закрыть
          </button>
          <button 
            className="buttonFromTemplate error-retry"
            onClick={() => loadImages(currentPage)}
          >
            <i className="fas fa-redo"></i> Повторить
          </button>
        </div>
      </div>
    );
  }, [error, loadImages, currentPage]);

  // Статистика изображений
  const imageStats = useMemo(() => {
    if (images.length === 0) return null;

    const totalSize = images.reduce((sum, img) => sum + (img.fileSize || 0), 0);
    const readableSize = Math.round(totalSize / 1024 / 1024 * 100) / 100;

    return (
      <div className="image-stats">
        <p>
          <strong>📊 Статистика страницы {currentPage}:</strong> 
          <span className="stat-item">Показано: {images.length} изображений</span>
          <span className="stat-item">Размер: {readableSize} MB</span>
          <span className="stat-item">Всего изображений: {pagination.totalItems}</span>
          <span className="stat-item">Страниц: {pagination.totalPages}</span>
        </p>
      </div>
    );
  }, [images, currentPage, pagination.totalItems, pagination.totalPages]);

  return (
    <div className="formForImageAndResult">
      {renderLoading}
      {renderError}
      
      {/* Компонент загрузки изображений */}
      <div className="upload-section-container">
        <h2>Загрузка нового изображения</h2>
        <ImageUpload onUploadSuccess={handleImageUploadSuccess} />
      </div>

      {/* Список изображений с пагинацией */}
      <div className="allDownloadImages" id="images-gallery">
        <div className="images-header">
          <h2>Загруженные изображения</h2>
          <div className="images-controls">
            <div className="page-info">
              Страница <strong>{currentPage}</strong> из <strong>{pagination.totalPages}</strong>
            </div>
            <button 
              className="buttonFromTemplate refresh-button"
              onClick={() => loadImages(currentPage)}
              disabled={isLoading}
              title="Обновить список"
            >
              <i className="fas fa-redo"></i> Обновить
            </button>
          </div>
        </div>
        
        {imageStats}
        
        {images.length === 0 && !isLoading ? (
          <div className="empty-images-message">
            <div className="empty-icon">
              <i className="fas fa-images fa-3x"></i>
            </div>
            <h3>Нет загруженных изображений</h3>
            <p>Загрузите первое изображение с помощью формы выше</p>
            <button 
              className="buttonFromTemplate go-to-upload-button"
              onClick={() => {
                const uploadSection = document.querySelector('.upload-section-container');
                uploadSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <i className="fas fa-arrow-up"></i> Перейти к загрузке
            </button>
          </div>
        ) : (
          <>
            {/* Пагинация сверху */}
            {pagination.totalPages > 1 && paginationComponent}
            
            {/* Галерея изображений */}
            {imageGallery}
            
            {/* Пагинация снизу */}
            {pagination.totalPages > 1 && paginationComponent}
            
            <div className="images-footer">
              <p className="images-count">
                Показано: <strong>{(currentPage - 1) * pagination.itemsPerPage + 1}-{Math.min(currentPage * pagination.itemsPerPage, pagination.totalItems)}</strong> из <strong>{pagination.totalItems}</strong> изображений
              </p>
              {images.length > 10 && (
                <button 
                  className="buttonFromTemplate scroll-to-top-button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  <i className="fas fa-arrow-up"></i> Вернуться к началу
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

ImagesContainerPaginated.displayName = 'ImagesContainerPaginated';

export default ImagesContainerPaginated;