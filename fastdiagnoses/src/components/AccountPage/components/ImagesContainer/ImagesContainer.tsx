// src/components/AccountPage/components/ImagesContainer/ImagesContainer.tsx
import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useAccountContext } from '../../context/AccountContext';
import { 
  getUserImages, 
  deleteImage, 
  getImageById,
  getImageUrl, 
  getThumbnailUrl,
  getMimeType,
  getReadableFileSize,
  isUsingFileSystem
} from '../../../../api/images.api';
import { UploadedImage } from '../../types/account.types';
import ImageUpload from '../ImageUpload/ImageUpload';
import ImageGallery from '../ImageGallery/ImageGallery';
import ImageModal from './ImageModal';
import './ImagesContainer.css';

const ImagesContainer: React.FC = React.memo(() => {
  const {
    images,
    setImages,
    selectedImage,
    setSelectedImage,
    showImageModal,
    setShowImageModal,
    setIsLoading,
    isLoading
  } = useAccountContext();

  const [error, setError] = useState<string | null>(null);
  const [selectedImageFull, setSelectedImageFull] = useState<UploadedImage | null>(null);

  // Загрузка изображений с поддержкой файловой системы
  const loadImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('📥 Начало загрузки изображений...');
      
      const result = await getUserImages();
      
      if (result.success && result.data) {
        console.log(`✅ Успешно загружено ${result.data.length} изображений`);
        
        // Проверяем формат данных для отладки
        result.data.forEach((img: UploadedImage, index: number) => {
          console.log(`Изображение ${index + 1}:`, {
            id: img.id,
            fileName: img.fileName,
            hasImageUrl: !!img.imageUrl,
            hasThumbnailUrl: !!img.thumbnailUrl,
            hasOriginIMG: !!img.originIMG,
            hasSmallImage: !!img.smallImage,
            isFileOnDisk: img.isFileOnDisk,
            fileSize: img.fileSize,
            dimensions: img.dimensions,
            fileUuid: img.fileUuid
          });
        });
        
        setImages(result.data);
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
  }, [setImages, setIsLoading]);

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
        
        // Обновляем локальный стейт
        setImages(prev => prev.filter(img => img.id !== imageId));
        
        // Закрываем модальное окно если удаляем текущее изображение
        if (selectedImage?.id === imageId || selectedImageFull?.id === imageId) {
          setSelectedImage(null);
          setSelectedImageFull(null);
          setShowImageModal(false);
        }
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
  }, [setImages, selectedImage, selectedImageFull, setSelectedImage, setShowImageModal, setIsLoading]);

  // Просмотр изображения (загружаем полную версию если нужно)
  const handleViewImage = useCallback(async (imageId: number) => {
    const image = images.find(img => img.id === imageId);
    if (!image) {
      console.error(`Изображение с ID ${imageId} не найдено`);
      setError(`Изображение с ID ${imageId} не найдено`);
      return;
    }

    // Если изображение уже имеет URL или Base64, используем его
    if (image.imageUrl || image.originIMG) {
      setSelectedImage(image);
      setSelectedImageFull(image);
      setShowImageModal(true);
      return;
    }

    // Если нет данных, загружаем полное изображение с сервера
    setIsLoading(true);
    try {
      const result = await getImageById(imageId);
      if (result.success && result.data) {
        const fullImage: UploadedImage = {
          ...image,
          // Обновляем URL если сервер предоставил
          imageUrl: result.data.imageUrl || image.imageUrl,
          thumbnailUrl: result.data.thumbnailUrl || image.thumbnailUrl,
          originIMG: result.data.image || image.originIMG,
          isFileOnDisk: result.data.isFileOnDisk || image.isFileOnDisk,
          fileUuid: result.data.fileUuid || image.fileUuid,
          fileSize: result.data.fileSize || image.fileSize,
          dimensions: result.data.dimensions || image.dimensions
        };
        
        setSelectedImageFull(fullImage);
        setShowImageModal(true);
        console.log(`✅ Загружено полное изображение для ID ${imageId}`);
      } else {
        setError(result.message || 'Не удалось загрузить изображение');
        console.error('❌ Ошибка загрузки изображения:', result.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Ошибка загрузки изображения';
      setError(errorMessage);
      console.error('❌ Ошибка загрузки изображения:', error);
    } finally {
      setIsLoading(false);
    }
  }, [images, setIsLoading, setShowImageModal, setSelectedImageFull, setSelectedImage]);

  // Загрузка нового изображения
  const handleImageUploadSuccess = useCallback(() => {
    console.log('🔄 Обновление списка изображений после загрузки...');
    loadImages();
  }, [loadImages]);

  // Скачивание изображения
  const handleDownloadImage = useCallback(() => {
    const imageToDownload = selectedImageFull || selectedImage;
    if (!imageToDownload) {
      setError('Нет изображения для скачивания');
      return;
    }

    try {
      const imageUrl = getImageUrl(imageToDownload);
      
      if (!imageUrl) {
        setError('Нет данных для скачивания изображения');
        console.error('❌ Нет данных для скачивания:', imageToDownload.fileName);
        return;
      }

      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = imageToDownload.fileName;
      
      // Добавляем в DOM, кликаем и удаляем
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`✅ Изображение "${imageToDownload.fileName}" скачивается`);
    } catch (error) {
      console.error('❌ Ошибка при скачивании изображения:', error);
      setError('Ошибка при скачивании изображения');
    }
  }, [selectedImage, selectedImageFull]);

  // Закрытие модального окна
  const handleCloseModal = useCallback(() => {
    setShowImageModal(false);
    setSelectedImage(null);
    setSelectedImageFull(null);
  }, [setShowImageModal, setSelectedImage, setSelectedImageFull]);

  // Первоначальная загрузка
  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Мемоизируем галерею изображений
  const imageGallery = useMemo(() => (
    <ImageGallery
      images={images}
      onView={handleViewImage}
      onDelete={handleDeleteImage}
    />
  ), [images, handleViewImage, handleDeleteImage]);

  // Внутри функции render модального окна:
const imageModal = useMemo(() => {
  if (!showImageModal) return null;

  const imageToShow = selectedImageFull || selectedImage;
  if (!imageToShow) return null;

  return (
    <ImageModal
      image={imageToShow}
      getMimeType={getMimeType}
      onDownload={handleDownloadImage}
      onClose={handleCloseModal}
    />
  );
}, [showImageModal, selectedImage, selectedImageFull, handleDownloadImage, handleCloseModal]);

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
            onClick={loadImages}
          >
            <i className="fas fa-redo"></i> Повторить
          </button>
        </div>
      </div>
    );
  }, [error, loadImages]);

  // Статистика изображений
  const imageStats = useMemo(() => {
    if (images.length === 0) return null;

    const totalSize = images.reduce((sum, img) => sum + (img.fileSize || 0), 0);
    const fileSystemImages = images.filter(img => isUsingFileSystem(img)).length;
    const base64Images = images.filter(img => img.originIMG && !isUsingFileSystem(img)).length;

    return (
      <div className="image-stats">
        <p>
          <strong>📊 Статистика:</strong> 
          <span className="stat-item">Всего: {images.length}</span>
          <span className="stat-item">Размер: {Math.round(totalSize / 1024 / 1024 * 100) / 100} MB</span>
          <span className="stat-item">Файловая система: {fileSystemImages}</span>
          <span className="stat-item">Base64: {base64Images}</span>
        </p>
      </div>
    );
  }, [images]);

  return (
    <div className="formForImageAndResult">
      {renderLoading}
      {renderError}
      
      {/* Компонент загрузки изображений */}
      <div className="upload-section-container">
        <h2>Загрузка нового изображения</h2>
        <ImageUpload onUploadSuccess={handleImageUploadSuccess} />
      </div>

      {/* Список изображений */}
      <div className="allDownloadImages">
        <div className="images-header">
          <h2>Загруженные изображения</h2>
          <div className="images-controls">
            <button 
              className="buttonFromTemplate refresh-button"
              onClick={loadImages}
              disabled={isLoading}
              title="Обновить список"
            >
              <i className="fas fa-redo"></i> Обновить
            </button>
            <button 
              className="buttonFromTemplate scroll-top-button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              title="Наверх"
            >
              <i className="fas fa-arrow-up"></i> Наверх
            </button>
          </div>
        </div>
        
        {imageStats}
        
        {images.length === 0 ? (
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
            {imageGallery}
            <div className="images-footer">
              <p className="images-count">
                Показано: <strong>{images.length}</strong> изображений
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

      {/* Модальное окно просмотра изображения */}
      {imageModal}
    </div>
  );
});

ImagesContainer.displayName = 'ImagesContainer';

export default ImagesContainer;