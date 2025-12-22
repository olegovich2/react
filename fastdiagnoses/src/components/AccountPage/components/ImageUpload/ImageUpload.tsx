import React, { useState, useRef, useEffect } from 'react';
import { uploadImage } from '../../../../api/images.api';
import { ImageUploadProps } from '../../types/account.types';
import './ImageUpload.css';

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onUploadSuccess,
  maxSize = 10,
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp']
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Очищаем preview URL при размонтировании
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Проверка типа файла
      if (!allowedTypes.includes(file.type)) {
        setMessage({
          text: `Пожалуйста, выберите изображение (${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')})`,
          type: 'error'
        });
        return;
      }
      
      // Проверка размера файла
      if (file.size > maxSize * 1024 * 1024) {
        setMessage({
          text: `Файл слишком большой. Максимальный размер: ${maxSize}MB`,
          type: 'error'
        });
        return;
      }
      
      // Очищаем старый preview
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      // Создаем preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
      
      setSelectedFile(file);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({
        text: 'Пожалуйста, выберите файл для загрузки',
        type: 'warning'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log('📤 Вызов uploadImage API с FormData...');
      
      // Используем новую версию uploadImage с поддержкой прогресса
      const result = await uploadImage(
        selectedFile, 
        comment,
        (progress) => {
          // РЕАЛЬНЫЙ прогресс из XMLHttpRequest
          setUploadProgress(progress);
        }
      );
      
      // Не нужно вручную ставить 100% - прогресс сам дойдет до 100

      if (result.success) {
        setMessage({
          text: 'Изображение успешно загружено!',
          type: 'success'
        });
        
        // Сброс формы
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        setComment('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Обновление списка изображений
        setTimeout(() => {
          onUploadSuccess();
          setIsUploading(false);
          setUploadProgress(0);
          setMessage(null);
        }, 1500);
      } else {
        setMessage({
          text: result.message || 'Ошибка при загрузке изображения',
          type: 'error'
        });
        setIsUploading(false);
        setUploadProgress(0);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки:', error);
      
      setUploadProgress(0);
      setIsUploading(false);
      
      let errorMessage = 'Ошибка соединения с сервером';
      
      if (error.message) {
        if (error.message.includes('Таймаут')) {
          errorMessage = 'Таймаут загрузки. Попробуйте еще раз.';
        } else if (error.message.includes('сети')) {
          errorMessage = 'Проблема с подключением. Проверьте интернет.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessage({
        text: errorMessage,
        type: 'error'
      });
    }
  };

  const handleCancel = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setComment('');
    setMessage(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="image-upload-form">
      <h3>Загрузка нового изображения</h3>
      
      <div className="image-upload-section">
        <input
          type="file"
          id="imageUpload"
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          ref={fileInputRef}
          disabled={isUploading}
          style={{ display: 'none' }}
        />
        
        <button
          className="image-upload-button image-upload-green-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <i className="fas fa-folder-open"></i> Выбрать изображение
        </button>
        
        {selectedFile && (
          <div className="image-upload-file-info-preview">
            <div className="image-upload-selected-file-info">
              <p><strong>Файл:</strong> {selectedFile.name}</p>
              <p><strong>Размер:</strong> {formatFileSize(selectedFile.size)}</p>
              <p><strong>Тип:</strong> {selectedFile.type}</p>
            </div>
            
            {previewUrl && (
              <div className="image-upload-preview-container">
                <h4>Предпросмотр:</h4>
                <div className="image-upload-preview-wrapper">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="image-upload-preview"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (img.naturalWidth > 500) {
                        img.style.maxWidth = '500px';
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="image-upload-comment-section">
        <label htmlFor="comment">Комментарий к изображению:</label>
        <textarea
          id="comment"
          className="image-upload-comment-input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Введите комментарий (необязательно)"
          rows={3}
          disabled={isUploading}
          maxLength={500}
        />
        <div className="image-upload-comment-counter">
          {comment.length}/500 символов
        </div>
      </div>

      {isUploading && (
        <div className="image-upload-progress-container">
          <div className="image-upload-progress-bar-wrapper">
            <div 
              className="image-upload-progress-bar" 
              style={{ width: `${uploadProgress}%` }}
              title={`${uploadProgress}%`}
            >
              {uploadProgress > 10 && `${uploadProgress}%`}
            </div>
          </div>
          <div className="image-upload-progress-details">
            <span className="image-upload-progress-text">
              {uploadProgress < 100 ? 'Загрузка...' : 'Обработка на сервере...'}
            </span>
            <span className="image-upload-file-size">
              ({formatFileSize(selectedFile?.size || 0)})
            </span>
          </div>
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="image-upload-speed">
              <small>Пожалуйста, не закрывайте страницу</small>
            </div>
          )}
        </div>
      )}

      {message && (
        <div className={`image-upload-message image-upload-${message.type}`}>
          <div className="image-upload-message-icon">
            {message.type === 'error' ? '❌' : 
             message.type === 'success' ? '✅' : '⚠️'}
          </div>
          <div className="image-upload-message-content">
            <strong>
              {message.type === 'error' ? 'Ошибка:' : 
               message.type === 'success' ? 'Успех:' : 'Внимание:'}
            </strong> 
            <span>{message.text}</span>
          </div>
          {message.type !== 'success' && (
            <button 
              className="image-upload-message-close"
              onClick={() => setMessage(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="image-upload-actions">
        <button
          className="buttonFromTemplateTwo image-upload-green-submit-button"
          type="button"
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
          title={!selectedFile ? "Выберите файл для загрузки" : ""}
        >
          {isUploading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> 
              {uploadProgress < 100 ? 'Загрузка...' : 'Обработка...'}
            </>
          ) : (
            <>
              <i className="fas fa-cloud-upload-alt"></i> Загрузить на сервер
            </>
          )}
        </button>
        
        <button
          className="buttonFromTemplateTwo image-upload-cancel-button"
          type="button"
          onClick={handleCancel}
          disabled={isUploading}
        >
          <i className="fas fa-times"></i> Отмена
        </button>
      </div>
    </div>
  );
};

ImageUpload.displayName = 'ImageUpload';

export default ImageUpload;