// src/components/AccountPage/pages/ImagePage/ImagePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getImageForViewPage, 
  deleteImage, 
  getImageUrl, 
  getMimeType,
  downloadImage
} from '../../../../api/images.api';
import { UploadedImage } from '../../types/account.types';
import './ImagePage.css';

const ImagePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Загрузка изображения
  const loadImage = useCallback(async () => {
    if (!id || isNaN(parseInt(id))) {
      setError('Некорректный ID изображения');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔍 Загрузка изображения ID: ${id}`);
      
      // Используем новый комбинированный метод
      const result = await getImageForViewPage(parseInt(id));
      
      if (result.success && result.data) {
        setImage(result.data);
        console.log(`✅ Изображение загружено: ${result.data.fileName}`);
      } else {
        setError(result.message || 'Изображение не найдено');
        console.error('❌ Ошибка загрузки изображения:', result.message);
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка загрузки изображения');
      console.error('❌ Ошибка загрузки изображения:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Удаление изображения
  const handleDelete = useCallback(async () => {
    if (!id || !image) return;
    
    if (!window.confirm(`Вы уверены, что хотите удалить изображение "${image.fileName}"?`)) {
      return;
    }

    try {
      const result = await deleteImage(parseInt(id));
      if (result.success) {
        console.log(`✅ Изображение ${id} удалено`);
        navigate('/account');
      } else {
        setError(result.message || 'Ошибка удаления изображения');
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка удаления изображения');
    }
  }, [id, image, navigate]);

  // Скачивание изображения
  const handleDownload = useCallback(() => {
    if (!image) return;
    
    try {
      downloadImage(image);
    } catch (error: any) {
      console.error('❌ Ошибка при скачивании:', error);
      setError('Ошибка при скачивании изображения');
    }
  }, [image]);

  // Увеличение/уменьшение масштаба
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setRotation(0);
  }, []);

  // Поворот изображения
  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  // Загрузка при монтировании
  useEffect(() => {
    loadImage();
  }, [loadImage]);

  // Обработка клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          navigate('/account');
          break;
        case '+':
        case '=':
          if (e.ctrlKey) handleZoomIn();
          break;
        case '-':
          if (e.ctrlKey) handleZoomOut();
          break;
        case '0':
          if (e.ctrlKey) handleResetZoom();
          break;
        case 'r':
        case 'к':
          if (e.ctrlKey) handleRotate();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, handleZoomIn, handleZoomOut, handleResetZoom, handleRotate]);

  // Отображение загрузки
  if (isLoading) {
    return (
      <div className="image-page-loading">
        <div className="spinner">
          <i className="fas fa-spinner fa-spin fa-3x"></i>
        </div>
        <p>Загрузка изображения...</p>
      </div>
    );
  }

  // Отображение ошибки
  if (error || !image) {
    return (
      <div className="image-page-error">
        <div className="error-icon">
          <i className="fas fa-exclamation-triangle fa-3x"></i>
        </div>
        <h2>Ошибка загрузки изображения</h2>
        <p>{error || 'Изображение не найдено'}</p>
        <div className="error-actions">
          <button className="buttonFromTemplate" onClick={() => navigate('/account')}>
            <i className="fas fa-arrow-left"></i> Вернуться в аккаунт
          </button>
          <button className="buttonFromTemplate" onClick={loadImage}>
            <i className="fas fa-redo"></i> Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Получаем URL изображения
  const imageUrl = getImageUrl(image);
  const mimeType = getMimeType(image.fileName);

  return (
    <div className="image-page-container">
      {/* Шапка страницы */}
      <header className="image-page-header">
        <button 
          className="back-button"
          onClick={() => navigate('/account')}
          title="Вернуться назад (Esc)"
        >
          <i className="fas fa-arrow-left"></i> Назад
        </button>
        
        <h1 className="image-title">
          <i className="fas fa-image"></i> {image.fileName}
        </h1>
        
        <div className="header-actions">
          <button 
            className="action-button download-button"
            onClick={handleDownload}
            title="Скачать изображение"
          >
            <i className="fas fa-download"></i> Скачать
          </button>
          <button 
            className="action-button delete-button"
            onClick={handleDelete}
            title="Удалить изображение"
          >
            <i className="fas fa-trash"></i> Удалить
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <div className="image-page-content">
        {/* Информационная панель */}
        <div className="image-info-panel">
          <div className="info-section">
            <h3><i className="fas fa-info-circle"></i> Информация</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Файл:</strong> {image.fileName}
              </div>
              {image.fileSize && (
                <div className="info-item">
                  <strong>Размер:</strong> {image.fileSize < 1024 ? 
                    `${image.fileSize} B` : 
                    image.fileSize < 1024 * 1024 ? 
                    `${(image.fileSize / 1024).toFixed(2)} KB` : 
                    `${(image.fileSize / (1024 * 1024)).toFixed(2)} MB`}
                </div>
              )}
              {image.dimensions && (
                <div className="info-item">
                  <strong>Разрешение:</strong> {image.dimensions}
                </div>
              )}
              {image.fileUuid && (
                <div className="info-item">
                  <strong>UUID:</strong> <code>{image.fileUuid}</code>
                </div>
              )}
              <div className="info-item">
                <strong>Формат:</strong> {mimeType.split('/')[1].toUpperCase()}
              </div>
              <div className="info-item">
                <strong>ID:</strong> {image.id}
              </div>
            </div>
          </div>

          {image.comment && (
            <div className="comment-section">
              <h3><i className="fas fa-comment"></i> Комментарий</h3>
              <p>{image.comment}</p>
            </div>
          )}
        </div>

        {/* Область просмотра изображения */}
        <div className="image-viewer-container">
          {/* Панель управления */}
          <div className="viewer-controls">
            <div className="zoom-controls">
              <button 
                className="control-button"
                onClick={handleZoomOut}
                title="Уменьшить (Ctrl + -)"
                disabled={scale <= 0.25}
              >
                <i className="fas fa-search-minus"></i>
              </button>
              <span className="scale-display">{Math.round(scale * 100)}%</span>
              <button 
                className="control-button"
                onClick={handleZoomIn}
                title="Увеличить (Ctrl + +)"
                disabled={scale >= 3}
              >
                <i className="fas fa-search-plus"></i>
              </button>
              <button 
                className="control-button"
                onClick={handleResetZoom}
                title="Сбросить масштаб (Ctrl + 0)"
              >
                <i className="fas fa-expand-arrows-alt"></i>
              </button>
            </div>
            
            <div className="transform-controls">
              <button 
                className="control-button"
                onClick={handleRotate}
                title="Повернуть на 90° (Ctrl + R)"
              >
                <i className="fas fa-redo"></i> Повернуть
              </button>
            </div>
            
            <div className="view-controls">
              <button 
                className="control-button"
                onClick={() => {
                  const viewer = document.querySelector('.image-viewer');
                  viewer?.requestFullscreen();
                }}
                title="Полноэкранный режим (F11)"
              >
                <i className="fas fa-expand"></i> Полный экран
              </button>
            </div>
          </div>

          {/* Область просмотра */}
          <div className="image-viewer">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={image.fileName}
                className="original-image"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  cursor: scale > 1 ? 'grab' : 'default'
                }}
                onError={(e) => {
                  console.error('Ошибка загрузки изображения:', imageUrl);
                  e.currentTarget.src = '/fallback-image.jpg';
                  e.currentTarget.alt = 'Изображение не загружено';
                }}
                onMouseDown={(e) => {
                  if (scale <= 1) return;
                  
                  const img = e.currentTarget;
                  let isDragging = false;
                  let startX = e.clientX;
                  let startY = e.clientY;
                  let currentX = parseFloat(img.style.marginLeft || '0');
                  let currentY = parseFloat(img.style.marginTop || '0');
                  
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    isDragging = true;
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;
                    
                    img.style.marginLeft = `${currentX + dx}px`;
                    img.style.marginTop = `${currentY + dy}px`;
                  };
                  
                  const handleMouseUp = () => {
                    if (!isDragging && scale > 1) {
                      // Клик для сброса положения
                      img.style.marginLeft = '0';
                      img.style.marginTop = '0';
                    }
                    
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            ) : (
              <div className="no-image">
                <i className="fas fa-exclamation-triangle fa-3x"></i>
                <p>Изображение не доступно</p>
              </div>
            )}
          </div>

          {/* Горячие клавиши */}
          <div className="hotkeys-info">
            <p>
              <strong>Горячие клавиши:</strong>{' '}
              <kbd>Ctrl + +</kbd> Увеличить •{' '}
              <kbd>Ctrl + -</kbd> Уменьшить •{' '}
              <kbd>Ctrl + 0</kbd> Сбросить •{' '}
              <kbd>Ctrl + R</kbd> Повернуть •{' '}
              <kbd>Esc</kbd> Назад
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImagePage;