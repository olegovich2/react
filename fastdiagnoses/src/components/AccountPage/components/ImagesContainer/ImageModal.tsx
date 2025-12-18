// src/components/AccountPage/components/ImagesContainer/ImageModal.tsx
import React from 'react';
import { UploadedImage } from '../../types/account.types'; // Убедитесь, что это правильный путь
import { getImageUrl, getMimeType as getApiMimeType } from '../../../../api/images.api';

interface ImageModalProps {
  image: UploadedImage;
  getMimeType: (filename: string) => string;
  onDownload: () => void;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = React.memo(({ 
  image, 
  getMimeType, 
  onDownload, 
  onClose 
}) => {
  
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Получаем URL изображения с учетом файловой системы
  const getImageSrc = (): string => {
    const imageUrl = getImageUrl(image);
    
    if (imageUrl && imageUrl.startsWith('data:')) {
      // Base64 - используем как есть
      return imageUrl;
    } else if (imageUrl) {
      // URL файловой системы
      return imageUrl;
    } else if (image.originIMG) {
      // Fallback на Base64
      return `data:${getMimeType(image.fileName)};base64,${image.originIMG}`;
    }
    
    // Если ничего нет, возвращаем пустую строку
    return '';
  };

  // Обработчик ошибки загрузки изображения
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Ошибка загрузки изображения в модальном окне:', image.fileName);
    
    // Пробуем использовать Base64 как fallback
    if (image.originIMG && !e.currentTarget.src.includes('data:')) {
      const mimeType = getMimeType(image.fileName);
      e.currentTarget.src = `data:${mimeType};base64,${image.originIMG}`;
      console.log('Использован Base64 как fallback');
    } else {
      e.currentTarget.src = '/fallback-image.jpg';
      e.currentTarget.alt = 'Изображение не загружено';
      console.log('Использовано fallback изображение');
    }
  };

  // Вычисляем размер файла
  const getImageSize = (): string => {
    if (image.fileSize) {
      if (image.fileSize < 1024) {
        return `${image.fileSize} B`;
      } else if (image.fileSize < 1024 * 1024) {
        return `${(image.fileSize / 1024).toFixed(2)} KB`;
      } else {
        return `${(image.fileSize / (1024 * 1024)).toFixed(2)} MB`;
      }
    } else if (image.originIMG) {
      return `${Math.round(image.originIMG.length * 3 / 4 / 1024)} KB`;
    }
    return 'Размер неизвестен';
  };

  // Определяем тип хранилища
  const getStorageType = (): string => {
    if (image.imageUrl || image.isFileOnDisk) {
      return 'Файловая система';
    } else if (image.originIMG) {
      return 'База данных (Base64)';
    }
    return 'Неизвестно';
  };

  const imageSrc = getImageSrc();
  const imageSize = getImageSize();
  const storageType = getStorageType();

  return (
    <div className="visibilityImage" onClick={handleBackdropClick}>
      <div className="blur"></div>
      
      <div className="imgWithButtonsOrigin" onClick={(e) => e.stopPropagation()}>
        <div className="blockVisIMG">
          {/* Оригинальное изображение */}
          {imageSrc ? (
            <img
              className="originImage"
              src={imageSrc}
              alt={image.fileName}
              title={image.fileName}
              onError={handleImageError}
              crossOrigin="anonymous" // Для CORS при работе с URL
            />
          ) : (
            <div className="image-loading-error">
              <i className="fas fa-exclamation-triangle fa-3x"></i>
              <p>Изображение не доступно</p>
            </div>
          )}
          
          {/* Информация об изображении */}
          <div className="image-info">
            <p><strong>📁 Файл:</strong> {image.fileName}</p>
            <p><strong>📏 Размер:</strong> {imageSize}</p>
            <p><strong>💾 Хранилище:</strong> {storageType}</p>
            
            {image.dimensions && (
              <p><strong>📐 Разрешение:</strong> {image.dimensions}</p>
            )}
            
            {image.created_at && (
              <p><strong>📅 Дата загрузки:</strong> {new Date(image.created_at).toLocaleDateString('ru-RU')}</p>
            )}
            
            <p>
              <strong>💬 Комментарий:</strong> {image.comment || "Нет комментария"}
            </p>
            
            {/* Индикатор формата */}
            <div className="format-indicator">
              {image.imageUrl && image.imageUrl.startsWith('/uploads/') && (
                <span className="file-system-indicator">
                  <i className="fas fa-hdd"></i> Файловая система
                </span>
              )}
              {image.originIMG && !image.imageUrl && (
                <span className="base64-indicator">
                  <i className="fas fa-database"></i> Base64
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Кнопки */}
        <div className="blockButtonsTwo">
          <button
            className="buttonFromTemplateTwo"
            type="button"
            onClick={onDownload}
            title="Скачать оригинальное изображение"
            disabled={!imageSrc}
          >
            <i className="fas fa-download"></i> 
            Скачать оригинальное изображение
          </button>
          <button
            className="buttonFromTemplateTwo"
            type="button"
            onClick={onClose}
          >
            <i className="fas fa-times"></i> Закрыть
          </button>
        </div>
      </div>
    </div>
  );
});

ImageModal.displayName = 'ImageModal';

export default ImageModal;