// src/components/AccountPage/components/ImagesContainer/ImagesContainer.tsx
import React, { useEffect, useCallback, useMemo } from 'react';
import { useAccountContext } from '../../context/AccountContext'; // ← Правильный путь!
import { getUserImages, deleteImage } from '../../../../api/images.api'; // ← uploadImage не нужен
import ImageUpload from '../ImageUpload/ImageUpload';
import ImageGallery from '../ImageGallery/ImageGallery';
import ImageModal from './ImageModal';

const ImagesContainer: React.FC = React.memo(() => {
  const {
    images,
    setImages,
    selectedImage,
    setSelectedImage,
    showImageModal,
    setShowImageModal,
    setIsLoading
  } = useAccountContext();

  // Загрузка изображений
  const loadImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getUserImages();
      if (result.success && result.data) {
        setImages(result.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки изображений:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setImages, setIsLoading]);

  // Удаление изображения
  const handleDeleteImage = useCallback(async (imageId: number) => {
    try {
      const result = await deleteImage(imageId);
      if (result.success) {
        // Обновляем локальный стейт с типизацией
        setImages(prev => prev.filter(img => img.id !== imageId));
        // Закрываем модальное окно если удаляем текущее изображение
        if (selectedImage?.id === imageId) {
          setSelectedImage(null);
          setShowImageModal(false);
        }
      }
    } catch (error) {
      console.error('Ошибка удаления изображения:', error);
    }
  }, [setImages, selectedImage, setSelectedImage, setShowImageModal]);

  // Просмотр изображения
  const handleViewImage = useCallback((imageId: number) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      setSelectedImage(image);
      setShowImageModal(true);
    }
  }, [images, setSelectedImage, setShowImageModal]);

  // Загрузка нового изображения
  const handleImageUploadSuccess = useCallback(() => {
    loadImages(); // Перезагружаем список
  }, [loadImages]);

  // Определение MIME типа
  const getMimeType = useCallback((filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      case 'tiff':
      case 'tif':
        return 'image/tiff';
      default:
        return 'image/jpeg';
    }
  }, []);

  // Скачивание изображения
  const handleDownloadImage = useCallback(() => {
    if (selectedImage && selectedImage.originIMG) {
      const mimeType = getMimeType(selectedImage.fileName);
      
      const link = document.createElement("a");
      link.href = `data:${mimeType};base64,${selectedImage.originIMG}`;
      link.download = selectedImage.fileName;
      link.click();
    }
  }, [selectedImage, getMimeType]);

  // Закрытие модального окна
  const handleCloseModal = useCallback(() => {
    setShowImageModal(false);
    setSelectedImage(null);
  }, [setShowImageModal, setSelectedImage]);

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

  return (
    <div className="formForImageAndResult">
      {/* Компонент загрузки изображений */}
      <ImageUpload onUploadSuccess={handleImageUploadSuccess} />

      {/* Список изображений */}
      <div className="allDownloadImages">
        <h2>Загруженные изображения</h2>
        {images.length === 0 ? (
          <div className="empty-message">
            <i className="fas fa-images"></i>
            <p>Нет загруженных изображений</p>
          </div>
        ) : (
          imageGallery
        )}
      </div>

      {/* Модальное окно просмотра изображения */}
      {showImageModal && selectedImage && (
        <ImageModal
          image={selectedImage}
          getMimeType={getMimeType}
          onDownload={handleDownloadImage}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
});

ImagesContainer.displayName = 'ImagesContainer';

export default ImagesContainer;