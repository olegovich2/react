import React, { useState, useRef } from 'react';
import { uploadImage } from '../../api/images.api';

interface ImageUploadProps {
  onUploadSuccess: () => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Проверка типа файла
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setMessage({
          text: 'Пожалуйста, выберите изображение (JPEG, PNG, GIF, BMP, WEBP)',
          type: 'error'
        });
        return;
      }
      
      // Проверка размера файла (максимум 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setMessage({
          text: 'Файл слишком большой. Максимальный размер: 10MB',
          type: 'error'
        });
        return;
      }
      
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
      // Показываем прогресс
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Используем существующую функцию загрузки
      console.log('📤 Вызов uploadImage API...');
      const result = await uploadImage(selectedFile, comment);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        setMessage({
          text: 'Изображение успешно загружено!',
          type: 'success'
        });
        
        // Сброс формы
        setSelectedFile(null);
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
      }
    } catch (error: any) {
      console.error('Ошибка загрузки:', error);
      
      setUploadProgress(0);
      setIsUploading(false);
      
      let errorMessage = 'Ошибка соединения с сервером';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage({
        text: errorMessage,
        type: 'error'
      });
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setComment('');
    setMessage(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="formForUploadOnServer">
      <h3>Загрузка нового изображения</h3>
      
      <div className="upload-section">
        <input
          type="file"
          id="imageUpload"
          accept="image/*"
          onChange={handleFileSelect}
          ref={fileInputRef}
          disabled={isUploading}
          style={{ display: 'none' }}
        />
        
        <button
          className="upload-button green-upload-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <i className="fas fa-folder-open"></i> Выбрать изображение
        </button>
        
        {selectedFile && (
          <div className="selected-file-info">
            <p><strong>Выбран файл:</strong> {selectedFile.name}</p>
            <p><strong>Размер:</strong> {(selectedFile.size / 1024).toFixed(2)} KB</p>
            <p><strong>Тип:</strong> {selectedFile.type}</p>
          </div>
        )}
      </div>

      <div className="comment-section">
        <label htmlFor="comment">Комментарий к изображению:</label>
        <textarea
          id="comment"
          className="comment-input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Введите комментарий (необязательно)"
          rows={3}
          disabled={isUploading}
        />
      </div>

      {isUploading && (
        <div className="upload-progress-container">
          <div 
            className="upload-progress-bar" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
          <div className="upload-progress-text">
            Загрузка: {uploadProgress}%
          </div>
        </div>
      )}

      {message && (
        <div className={`upload-message upload-${message.type}`}>
          <strong>
            {message.type === 'error' ? '❌ Ошибка:' : 
             message.type === 'success' ? '✅ Успех:' : 
             '⚠️ Внимание:'}
          </strong> {message.text}
        </div>
      )}

      <div className="upload-actions">
        <button
          className="buttonFromTemplateTwo green-submit-button"
          type="button"
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
        >
          {isUploading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Загрузка...
            </>
          ) : (
            <>
              <i className="fas fa-cloud-upload-alt"></i> Загрузить на сервер
            </>
          )}
        </button>
        
        <button
          className="buttonFromTemplateTwo cancel-button"
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

export default ImageUpload;