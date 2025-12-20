import React from 'react';
import { UploadedImage, ImageGalleryProps } from '../../types/account.types';
import { getThumbnailUrl, getReadableFileSize } from '../../../../api/images.api';
import './ImageGallery.css';

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onView, onDelete }) => {
  if (images.length === 0) {
    return (
      <div className="empty-images-message">
        <i className="fas fa-images fa-2x"></i>
        <p>Нет загруженных изображений</p>
      </div>
    );
  }

  // Функция для получения fallback URL
  const getFallbackUrl = (image: UploadedImage): string => {
    // Используем imageUrl как fallback вместо оригинального URL
    if (image.imageUrl && image.imageUrl !== image.thumbnailUrl) {
      return image.imageUrl;
    }
    
    // Иначе placeholder
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9IiNmMGYwZjAiPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIi8+PHRleHQgeD0iNTAiIHk9IjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2NjYiPk5vIGltYWdlPC90ZXh0Pjwvc3ZnPg==';
  };

  return (
    <div className="image-gallery-container">
      {images.map((image) => {
        const thumbnailUrl = getThumbnailUrl(image);
        const fileSize = getReadableFileSize(image);
        const fallbackUrl = getFallbackUrl(image);
        
        return (
          <div key={image.id || image.fileUuid || `image-${image.id}`} 
               className="image-item" 
               data-image-id={image.id}>
            
            {/* Превью изображения */}
            <div className="image-preview">
              {thumbnailUrl ? (
                <img 
                  src={thumbnailUrl} 
                  alt={image.fileName || 'Изображение'}
                  className="thumbnail"
                  onClick={() => onView(image)}
                  onError={(e) => {
                    console.log(`Ошибка загрузки ${thumbnailUrl}, пробуем fallback`);
                    e.currentTarget.src = fallbackUrl;
                    e.currentTarget.onerror = null; // Отключаем повторные ошибки
                  }}
                  loading="lazy"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="thumbnail-placeholder">
                  <i className="fas fa-image fa-2x"></i>
                  <span>Нет превью</span>
                </div>
              )}
              
              <div className="filesystem-badge" title="Файл хранится на диске">
                <i className="fas fa-hdd"></i>
              </div>
            </div>
            
            {/* Информация об изображении */}
            <div className="image-info">
              <p className="image-filename">
                <strong>📁 Файл:</strong> {image.fileName || 'Неизвестный файл'}
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
              
              <p className="image-url">
                <strong>🔗 URL:</strong> 
                <small>{thumbnailUrl ? (thumbnailUrl.length > 50 ? thumbnailUrl.substring(0, 50) + '...' : thumbnailUrl) : 'Нет URL'}</small>
              </p>
            </div>
            
            {/* Кнопки действий */}
            <div className="image-actions">
              <button 
                className="buttonFromTemplate view-image-button" 
                type="button"
                onClick={() => onView(image)}
                title="Просмотреть изображение"
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