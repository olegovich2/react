import React from 'react';
import { UploadedImage } from '../../types/account.types';
import { getThumbnailUrl, getReadableFileSize, isUsingFileSystem } from '../../../../api/images.api';

interface ImageGalleryProps {
  images: UploadedImage[];
  onView: (imageId: number) => void;
  onDelete: (imageId: number) => void;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onView, onDelete }) => {
  if (images.length === 0) {
    return (
      <div className="empty-images-message">
        <i className="fas fa-images fa-2x"></i>
        <p>Нет загруженных изображений</p>
      </div>
    );
  }

  // Функция для обработки ошибок загрузки изображения
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, image: UploadedImage) => {
    console.error(`Ошибка загрузки изображения: ${image.fileName}`);
    const target = e.currentTarget;
    
    // Пробуем использовать Base64 как fallback
    if (image.originIMG && !target.src.includes('data:')) {
      const mimeType = getMimeTypeFallback(image.fileName);
      target.src = `data:${mimeType};base64,${image.originIMG}`;
    } else {
      target.src = '/fallback-thumbnail.jpg';
      target.alt = 'Изображение не загружено';
    }
  };

  // Вспомогательная функция для определения MIME типа
  const getMimeTypeFallback = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/jpeg';
    }
  };

  return (
    <div className="image-gallery-container">
      {images.map((image) => {
        const thumbnailUrl = getThumbnailUrl(image);
        const fileSize = getReadableFileSize(image);
        const usingFileSystem = isUsingFileSystem(image);
        
        return (
          <div key={image.id || image.fileUuid || image.fileName} 
               className="image-item" 
               data-image-id={image.id}>
            
            {/* Превью изображения */}
            <div className="image-preview">
              {thumbnailUrl ? (
                <img 
                  src={thumbnailUrl} 
                  alt={image.fileName}
                  className="thumbnail"
                  onClick={() => onView(image.id)}
                  onError={(e) => handleImageError(e, image)}
                  loading="lazy"
                />
              ) : (
                <div className="thumbnail-placeholder">
                  <i className="fas fa-image fa-2x"></i>
                  <span>Нет превью</span>
                </div>
              )}
              
              {/* Бейдж файловой системы */}
              {usingFileSystem && (
                <div className="filesystem-badge" title="Файл хранится на диске">
                  <i className="fas fa-hdd"></i>
                </div>
              )}
            </div>
            
            {/* Информация об изображении */}
            <div className="image-info">
              <p className="image-filename">
                <strong>📁 Файл:</strong> {image.fileName}
              </p>
              
              <p className="image-comment">
                <strong>💬 Комментарий:</strong> {image.comment || "Нет комментария"}
              </p>
              
              {image.fileSize && (
                <p className="image-size">
                  <strong>📏 Размер:</strong> {fileSize}
                </p>
              )}
              
              {image.dimensions && (
                <p className="image-dimensions">
                  <strong>📐 Разрешение:</strong> {image.dimensions}
                </p>
              )}
              
              {image.created_at && (
                <p className="image-date">
                  <strong>📅 Дата загрузки:</strong> {new Date(image.created_at).toLocaleDateString('ru-RU')}
                </p>
              )}
              
              <p className="image-storage">
                <strong>💾 Хранилище:</strong> 
                {usingFileSystem ? ' Файловая система' : ' База данных (Base64)'}
              </p>
            </div>
            
            {/* Кнопки действий */}
            <div className="image-actions">
              <button 
                className="buttonFromTemplate view-image-button" 
                type="button"
                onClick={() => onView(image.id)}
                title="Просмотреть изображение"
                disabled={!thumbnailUrl && !image.originIMG}
              >
                <i className="fas fa-eye"></i> Просмотреть
              </button>
              
              <button 
                className="buttonFromTemplate delete-image-button" 
                type="button"
                onClick={() => onDelete(image.id)}
                title="Удалить изображение"
              >
                <i className="fas fa-trash-alt"></i> Удалить
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ImageGallery;