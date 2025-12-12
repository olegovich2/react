// ImageUpload.tsx - минимальная версия без ошибок
import React, { useState, useRef } from 'react';
import { uploadImage, validateFile } from '../../api/images.api';

interface ImageUploadProps {
  onUploadSuccess?: () => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.message || 'Недопустимый файл');
      return;
    }

    setError(null);
    await handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    
    try {
      const result = await uploadImage(file, 'Медицинское изображение');
      
      if (result.success) {
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        setError(result.message || 'Ошибка загрузки');
      }
    } catch (error: any) {
      setError(error.message || 'Неизвестная ошибка');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="image-upload">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
        disabled={uploading}
      />
      
      <button
        onClick={handleButtonClick}
        disabled={uploading}
        className="upload-button"
      >
        {uploading ? 'Загрузка...' : 'Загрузить изображение'}
      </button>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;