// src/components/AccountPage/components/ImagesContainer/ImageModal.tsx
import React from 'react';
import { UploadedImage } from '../../../../types/api.types';

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

  const imageSize = image.originIMG 
    ? `${Math.round(image.originIMG.length * 3 / 4 / 1024)} KB` 
    : 'Миниатюра (100x100px)';

  return (
    <div className="visibilityImage" onClick={handleBackdropClick}>
      <div className="blur"></div>
      
      <div className="imgWithButtonsOrigin" onClick={(e) => e.stopPropagation()}>
        <div className="blockVisIMG">
          {/* Оригинальное изображение */}
          <img
            className="originImage"
            src={`data:${getMimeType(image.fileName)};base64,${image.originIMG}`}
            alt={image.fileName}
            title={image.fileName}
          />
          
          {/* Информация об изображении */}
          <div className="image-info">
            <p><strong>📁 Файл:</strong> {image.fileName}</p>
            <p><strong>📏 Размер:</strong> {imageSize}</p>
            <p>
              <strong>💬 Комментарий:</strong> {image.comment || "Нет комментария"}
            </p>
          </div>
        </div>
        
        {/* Кнопки */}
        <div className="blockButtonsTwo">
          <button
            className="buttonFromTemplateTwo"
            type="button"
            onClick={onDownload}
            title="Скачать оригинальное изображение"
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