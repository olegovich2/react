import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountContext } from '../../context/AccountContext';
import { 
  getPaginatedImages,
  deleteImage, 
} from '../../../../api/images.api';
import { UploadedImage } from '../../types/account.types';
import ImageUpload from '../ImageUpload/ImageUpload';
import ImageGallery from '../ImageGallery/ImageGallery';
import Pagination from '../Pagination/Pagination';
import './ImagesContainer.css';

const ImagesContainerPaginated: React.FC = React.memo(() => {
  const {
    setImages,
    setIsLoading,
    isLoading,
    imagesPagination,
    setImagesPagination,
    updateImagesPage
  } = useAccountContext();

  const navigate = useNavigate();

  const [localImages, setLocalImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Загрузка изображений с пагинацией
  const loadImages = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    setCurrentPage(page);
    
    try {
      console.log(`📥 Загрузка изображений, страница ${page}...`);
      
      const result = await getPaginatedImages({
        page,
        limit: imagesPagination.itemsPerPage
      });
      
      if (result.success && result.data) {
        console.log(`✅ Успешно загружено ${result.data.images?.length || 0} изображений`);
        
        // Обновляем изображения с правильной типизацией
        setLocalImages(result.data.images || []);
        
        if (result.data.pagination) {
          setImagesPagination({
            currentPage: page,
            totalPages: result.data.pagination.totalPages,
            totalItems: result.data.pagination.totalItems,
            itemsPerPage: imagesPagination.itemsPerPage
          });
        }
        
        // Обновляем контекст для обратной совместимости
        setImages(result.data.images || []);
        
        console.log(`📊 Пагинация: страница ${page} из ${result.data.pagination?.totalPages || 1}`);
      } else {
        setError(result.message || 'Не удалось загрузить изображений');
        console.error('❌ Ошибка загрузки изображений:', result.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Ошибка соединения с сервером';
      setError(errorMessage);
      console.error('❌ Ошибка загрузки изображений:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setImages, setIsLoading, imagesPagination.itemsPerPage, setImagesPagination]);

  // Обработчик смены страницы
  const handlePageChange = useCallback((page: number) => {
    console.log(`🔄 Переход на страницу ${page}`);
    loadImages(page);
    // Обновляем страницу в контексте отдельно, чтобы избежать циклов
    updateImagesPage(page);
  }, [loadImages, updateImagesPage]);

  // Прокрутка к галерее после смены страницы
  const scrollToGallery = useCallback(() => {
    const gallery = document.querySelector('.images-container-all-download-images');
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

  // Просмотр изображения - ИСПРАВЛЕНО: передаем UUID вместо ID
  const handleViewImage = useCallback((image: UploadedImage) => {
    console.log('🖼️ Переход к просмотру изображения...', {
      id: image.id,
      uuid: image.fileUuid,
      fileName: image.fileName,
      currentPage,
      from: 'ImagesContainer'
    });
    
    // Сохраняем текущую страницу перед переходом
    updateImagesPage(currentPage);
    
    // ✅ Передаем UUID в URL вместо ID
    if (!image.fileUuid) {
      console.error('❌ У изображения нет UUID:', image);
      alert('Ошибка: у изображения нет UUID');
      return;
    }
    
    navigate(`/account/images/original/${image.fileUuid}`);
  }, [currentPage, updateImagesPage, navigate]);

  // Загрузка нового изображения
  const handleImageUploadSuccess = useCallback(() => {
    console.log('🔄 Обновление списка изображений после загрузки...');
    // После загрузки нового изображения возвращаемся на первую страницу
    loadImages(1);
    updateImagesPage(1);
  }, [loadImages, updateImagesPage]);

  // Первоначальная загрузка - используем сохраненную страницу из контекста
  useEffect(() => {
    const initialPage = imagesPagination.currentPage;
    console.log(`🔄 Начальная загрузка изображений. Страница из контекста: ${initialPage}...`);
    setCurrentPage(initialPage);
    loadImages(initialPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Загружаем только при монтировании

  // Мемоизируем галерею изображений
  const imageGallery = useMemo(() => (
    <ImageGallery
      images={localImages}
      onView={handleViewImage}
      onDelete={handleDeleteImage}
    />
  ), [localImages, handleViewImage, handleDeleteImage]);

  // Мемоизируем пагинацию
  const paginationComponent = useMemo(() => {
    if (!imagesPagination || imagesPagination.totalPages <= 1) return null;
    
    return (
      <Pagination
        currentPage={imagesPagination.currentPage}
        totalPages={imagesPagination.totalPages}
        totalItems={imagesPagination.totalItems}
        onPageChange={handlePageChange}
        scrollToElement={scrollToGallery}
        autoScroll={true}
      />
    );
  }, [imagesPagination, handlePageChange, scrollToGallery]);

  // Отображение статуса загрузки
  const renderLoading = useMemo(() => {
    if (!isLoading) return null;
    
    return (
      <div className="images-container-loading-overlay">
        <div className="images-container-loading-spinner">
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
      <div className="images-container-error-message">
        <i className="fas fa-exclamation-triangle"></i>
        <p>{error}</p>
        <div className="images-container-error-actions">
          <button 
            className="buttonFromTemplate images-container-error-close"
            onClick={() => setError(null)}
          >
            <i className="fas fa-times"></i> Закрыть
          </button>
          <button 
            className="buttonFromTemplate images-container-error-retry"
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
    if (localImages.length === 0) return null;

    const totalSize = localImages.reduce((sum, img) => sum + (img.fileSize || 0), 0);
    const readableSize = Math.round(totalSize / 1024 / 1024 * 100) / 100;

    return (
      <div className="images-container-stats">
        <p>
          <strong>📊 Статистика страницы {currentPage}:</strong> 
          <span className="images-container-stat-item">Показано: {localImages.length} изображений</span>
          <span className="images-container-stat-item">Размер: {readableSize} MB</span>
          <span className="images-container-stat-item">Всего изображений: {imagesPagination.totalItems}</span>
          <span className="images-container-stat-item">Страниц: {imagesPagination.totalPages}</span>
        </p>
      </div>
    );
  }, [localImages, currentPage, imagesPagination.totalItems, imagesPagination.totalPages]);

  return (
    <div className="images-container-form">
      {renderLoading}
      {renderError}
      
      {/* Компонент загрузки изображений */}
      <div className="images-container-upload-section">
        <h2>Загрузка нового изображения</h2>
        <ImageUpload onUploadSuccess={handleImageUploadSuccess} />
      </div>

      {/* Список изображений с пагинацией */}
      <div className="images-container-all-download-images" id="images-container-gallery">
        <div className="images-container-header">
          <h2>Загруженные изображения</h2>
          <div className="images-container-controls">
            <div className="images-container-page-info">
              Страница <strong>{currentPage}</strong> из <strong>{imagesPagination.totalPages}</strong>
            </div>
            <button 
              className="buttonFromTemplate images-container-refresh-button"
              onClick={() => loadImages(currentPage)}
              disabled={isLoading}
              title="Обновить список"
            >
              <i className="fas fa-redo"></i> Обновить
            </button>
          </div>
        </div>
        
        {imageStats}
        
        {localImages.length === 0 && !isLoading ? (
          <div className="images-container-empty-message">
            <div className="images-container-empty-icon">
              <i className="fas fa-images fa-3x"></i>
            </div>
            <h3>Нет загруженных изображений</h3>
            <p>Загрузите первое изображение с помощью формы выше</p>
            <button 
              className="buttonFromTemplate images-container-go-to-upload-button"
              onClick={() => {
                const uploadSection = document.querySelector('.images-container-upload-section');
                uploadSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <i className="fas fa-arrow-up"></i> Перейти к загрузке
            </button>
          </div>
        ) : (
          <>
            {/* Пагинация сверху */}
            {imagesPagination.totalPages > 1 && paginationComponent}
            
            {/* Галерея изображений */}
            {imageGallery}
            
            {/* Пагинация снизу */}
            {imagesPagination.totalPages > 1 && paginationComponent}
            
            <div className="images-container-footer">
              <p className="images-container-count">
                Показано: <strong>{(currentPage - 1) * imagesPagination.itemsPerPage + 1}-{Math.min(currentPage * imagesPagination.itemsPerPage, imagesPagination.totalItems)}</strong> из <strong>{imagesPagination.totalItems}</strong> изображений
              </p>
              {localImages.length > 10 && (
                <button 
                  className="buttonFromTemplate images-container-scroll-to-top-button"
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