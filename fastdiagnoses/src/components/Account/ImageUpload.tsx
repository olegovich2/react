import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';

interface ImageUploadProps {
  onUpload: (file: File, comment: string) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isConnected } = useWebSocket();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Проверка типа файла
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(selectedFile.type)) {
        alert('Пожалуйста, выберите файл изображения (JPEG, PNG или GIF)');
        return;
      }
      
      // Проверка размера файла (например, 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 10MB');
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert('WebSocket не подключен. Пожалуйста, подождите...');
      return;
    }

    if (!file) {
      alert('Пожалуйста, выберите файл');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file, comment);
      
      // Сброс формы после успешной загрузки
      setFile(null);
      setComment('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      alert('Произошла ошибка при загрузке файла');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="uploadOnServer" data-div="uploadOnServer">
      <form className="formForUploadOnServer" data-form="formForUploadOnServer" onSubmit={handleSubmit}>
        <p>Здесь Вы можете загрузить изображение (флюорографию, изображения сыпи и тд.):</p>
        
        <input 
          className="file" 
          type="file" 
          name="fileName"
          data-input="fileChoice"
          accept="image/jpeg, image/png, image/gif, .jpg, .jpeg, .png, .gif"
          onChange={handleFileChange}
          ref={fileInputRef}
          disabled={isUploading}
        />
        
        <textarea 
          className="comment" 
          rows={4}
          placeholder="Введите комментарий"
          name="textareaComment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isUploading}
        />
        
        <button 
          className="buttonFromTemplate" 
          type="button"
          data-button="buttonUpload"
          onClick={handleSubmit}
          disabled={isUploading || !isConnected}
        >
          {isUploading ? 'Загрузка...' : 'Загрузить'}
        </button>
        
        {!isConnected && (
          <div className="errors_p">
            WebSocket не подключен. Загрузка изображений временно недоступна.
          </div>
        )}
      </form>
    </div>
  );
};

export default ImageUpload;