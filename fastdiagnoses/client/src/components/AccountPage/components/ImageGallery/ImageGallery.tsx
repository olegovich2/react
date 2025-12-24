import React from 'react';
import { UploadedImage, ImageGalleryProps } from '../../types/account.types';
import { getThumbnailUrl, getReadableFileSize } from '../../../../api/images.api';
import './ImageGallery.css';

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onView, onDelete }) => {
  if (images.length === 0) {
    return (
      <div className="image-gallery-empty-message">
        <i className="fas fa-images fa-2x"></i>
        <p>Нет загруженных изображений</p>
      </div>
    );
  }

  // Функция для получения fallback URL
  const getFallbackUrl = (image: UploadedImage): string => {
    if (image.imageUrl && image.imageUrl !== image.thumbnailUrl) {
      return image.imageUrl;
    }
    
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9IiNmMGYwZjAiPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIi8+PHRleHQgeD0iNTAiIHk9IjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2NjYiPk5vIGltYWdlPC90ZXh0Pjwvc3ZnPg==';
  };

  // Обработчик клика по карточке
  const handleCardClick = (image: UploadedImage, e: React.MouseEvent) => {
    // Проверяем, не кликнули ли на кнопку удаления
    const target = e.target as HTMLElement;
    if (target.closest('.image-gallery-delete-button')) {
      return; // Не обрабатываем клик по кнопке удаления
    }
    onView(image);
  };

  // Обработчик клика по кнопке удаления
  const handleDeleteClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Останавливаем всплытие, чтобы не сработал клик по карточке
    onDelete(id);
  };

  return (
    <div className="image-gallery-grid">
      {images.map((image) => {
        const thumbnailUrl = getThumbnailUrl(image);
        const fileSize = getReadableFileSize(image);
        const fallbackUrl = getFallbackUrl(image);
        
        return (
          <div 
            key={image.id || image.fileUuid || `image-${image.id}`} 
            className="image-gallery-card" 
            data-image-id={image.id}
            onClick={(e) => handleCardClick(image, e)}
          >
            
            {/* Превью изображения */}
            <div className="image-gallery-preview">
              {thumbnailUrl ? (
                <img 
                  src={thumbnailUrl} 
                  alt={image.fileName || 'Изображение'}
                  className="image-gallery-thumbnail"
                  onError={(e) => {
                    console.log(`Ошибка загрузки ${thumbnailUrl}, пробуем fallback`);
                    e.currentTarget.src = fallbackUrl;
                    e.currentTarget.onerror = null;
                  }}
                  loading="lazy"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="image-gallery-placeholder">
                  <i className="fas fa-image fa-2x"></i>
                  <span>Нет превью</span>
                </div>
              )}
              
              <div className="image-gallery-filesystem-badge" title="Файл хранится на диске">
                <i className="fas fa-hdd"></i>
              </div>

              {/* Наложение при наведении */}
              <div className="image-gallery-overlay">
                <div className="image-gallery-view-action">
                  <i className="fas fa-eye"></i>
                  <span>Просмотреть</span>
                </div>
              </div>
            </div>
            
            {/* Информация об изображении */}
            <div className="image-gallery-info">
              <p className="image-gallery-filename" title={image.fileName || 'Неизвестный файл'}>
                {image.fileName || 'Неизвестный файл'}
              </p>
              
              <div className="image-gallery-meta">
                {image.fileSize && (
                  <span className="image-gallery-size">
                    <i className="fas fa-weight-hanging"></i> {fileSize}
                  </span>
                )}
                
                {image.dimensions && (
                  <span className="image-gallery-dimensions">
                    <i className="fas fa-expand-alt"></i> {image.dimensions}
                  </span>
                )}
                
                {image.created_at && (
                  <span className="image-gallery-date">
                    <i className="far fa-calendar"></i> {new Date(image.created_at).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </div>
              
              {image.comment && (
                <p className="image-gallery-comment" title={image.comment}>
                  <i className="far fa-comment"></i> {image.comment.length > 50 ? image.comment.substring(0, 50) + '...' : image.comment}
                </p>
              )}
            </div>
            
            {/* Кнопка удаления (только она, кнопка просмотра убрана) */}
            <button 
              className="image-gallery-delete-button buttonFromTemplate" 
              type="button"
              onClick={(e) => handleDeleteClick(image.id, e)}
              title="Удалить изображение"
            >
              <i className="fas fa-trash-alt"></i> Удалить
            </button>
          </div>
        );
      })}
    </div>
  );
};

ImageGallery.displayName = 'ImageGallery';

export default ImageGallery;