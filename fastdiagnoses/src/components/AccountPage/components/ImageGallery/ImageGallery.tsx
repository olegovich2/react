import React from 'react';
import { UploadedImage } from '../../../../types/api.types';

interface ImageGalleryProps {
  images: UploadedImage[];
  onView: (imageId: number) => void;
  onDelete: (imageId: number) => void;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onView, onDelete }) => {
  if (images.length === 0) {
    return <div>Нет загруженных изображений</div>;
  }

  return (
    <div className="image-gallery-container">
      {images.map((image) => (
        <div key={image.id} className="image-item" data-image-id={image.id}>
          <div className="image-preview">
            {image.smallImage && (
              <img 
                src={`data:image/jpeg;base64,${image.smallImage}`} 
                alt={image.fileName}
                className="thumbnail"
                onClick={() => onView(image.id)}
              />
            )}
          </div>
          
          <div className="image-info">
            <p className="image-filename">
              <strong>📁 Файл:</strong> {image.fileName}
            </p>
            <p className="image-comment">
              <strong>💬 Комментарий:</strong> {image.comment || "Нет комментария"}
            </p>
            <p className="image-size">
              <strong>📏 Размер:</strong> {image.originIMG 
                ? `${Math.round(image.originIMG.length * 3 / 4 / 1024)} KB` 
                : 'Миниатюра (100x100px)'}
            </p>
          </div>
          
          <div className="image-actions">
            <button 
              className="buttonFromTemplate view-image-button" 
              type="button"
              onClick={() => onView(image.id)}
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
      ))}
    </div>
  );
};

export default ImageGallery;