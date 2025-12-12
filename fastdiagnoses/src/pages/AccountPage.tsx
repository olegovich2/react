import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import SurveyList from '../components/Account/SurveyList';
import ImageUpload from '../components/Account/ImageUpload';
import ImageGallery from '../components/Account/ImageGallery';
import ResultSurvey from '../components/Account/ResultSurvey';

import { getUserSurveys, deleteSurvey } from '../api/surveys.api';
import { getUserImages, deleteImage } from '../api/images.api';
import { Survey, UploadedImage } from '../types/api.types';

interface AccountSurvey extends Survey {
  id: number;
}

const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [surveys, setSurveys] = useState<AccountSurvey[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<AccountSurvey | null>(null);
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
  const [showSurveyResult, setShowSurveyResult] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 🔧 Загрузка данных аккаунта
  useEffect(() => {
    const loadAccountData = async () => {
      setIsLoading(true);
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.login) {
          navigate('/login');
          return;
        }

        // Загружаем опросы
        const surveyResult = await getUserSurveys(user.login);
        if (surveyResult.success && surveyResult.data.surveys) {
          setSurveys(surveyResult.data.surveys.map((survey: Survey, index: number) => ({
            ...survey,
            id: survey.id || index + 1
          })));
        }

        // Загружаем изображения
        const imageResult = await getUserImages();
        if (imageResult.success && imageResult.images) {
          setImages(imageResult.images);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccountData();
  }, [navigate]);

  // 🔧 Просмотр опроса
  const handleViewSurvey = (survey: AccountSurvey) => {
    setSelectedSurvey(survey);
    setShowSurveyResult(true);
  };

  // 🔧 Удаление опроса
  const handleDeleteSurvey = async (id: number) => {
    try {
const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.login) {
          navigate('/login');
          return;
        }

      const result = await deleteSurvey(user.login, id);
      if (result.success) {
        // Обновляем локальное состояние
        setSurveys(prev => prev.filter(survey => survey.id !== id));
        
        if (selectedSurvey?.id === id) {
          setSelectedSurvey(null);
          setShowSurveyResult(false);
        }
      }
    } catch (error) {
      console.error('Ошибка удаления опроса:', error);
    }
  };

  // 🔧 Просмотр изображения
  const handleViewImage = (imageId: number) => {
    const image = images.find(img => img.id === imageId);
    setSelectedImage(image || null);
  };

  // 🔧 Удаление изображения
  const handleDeleteImage = async (imageId: number) => {
    try {
      const result = await deleteImage(imageId);
      if (result.success) {
        setImages(prev => prev.filter(img => img.id !== imageId));
        if (selectedImage?.id === imageId) {
          setSelectedImage(null);
        }
      }
    } catch (error) {
      console.error('Ошибка удаления изображения:', error);
    }
  };

  // 🔧 Обновление данных после загрузки изображения
  const handleImageUploadSuccess = async () => {
    try {
      const imageResult = await getUserImages();
      if (imageResult.success && imageResult.images) {
        setImages(imageResult.images);
      }
    } catch (error) {
      console.error('Ошибка обновления изображений:', error);
    }
  };

  // 🔧 Закрытие опроса
  const handleCloseSurvey = () => {
    setShowSurveyResult(false);
    setSelectedSurvey(null);
  };

  // 🔧 Закрытие изображения
  const handleCloseImage = () => {
    setSelectedImage(null);
  };

  // 🔧 Скачивание изображения
  const handleDownloadImage = () => {
    if (selectedImage && selectedImage.smallImage) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${selectedImage.smallImage}`;
      link.download = selectedImage.fileName || 'image.png';
      link.click();
    }
  };

  // 🔧 Сохранение как Word (базовая версия)
  const handleSaveAsWord = (survey: AccountSurvey) => {
    const dateStr = survey.createdAt ? 
      new Date(survey.createdAt).toLocaleDateString('ru-RU').split('.').join('_') : 
      'unknown_date';
    
    const content = `
      <html>
      <head><meta charset="utf-8"><title>Результат опроса</title></head>
      <body>
        <h1>Результат медицинского опроса</h1>
        <p><strong>Система:</strong> ${survey.system}</p>
        <p><strong>Дата:</strong> ${survey.createdAt || 'Не указана'}</p>
        <h2>Симптомы:</h2>
        <pre>${JSON.stringify(survey.symptoms, null, 2)}</pre>
        ${survey.diagnosis ? `<h2>Диагноз:</h2><p>${survey.diagnosis.join(', ')}</p>` : ''}
        ${survey.recommendations ? `<h2>Рекомендации:</h2><p>${survey.recommendations.join(', ')}</p>` : ''}
      </body>
      </html>
    `;
    
    const source = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(content);
    const fileDownload = document.createElement('a');
    fileDownload.href = source;
    fileDownload.download = `Результат_опроса_${dateStr}.doc`;
    fileDownload.click();
  };

  return (
    <div className="general" data-main="mainElement">
      <Header showBackButton={true} />
      
      <main className="general">
        <div className="mainAccount">
          {/* Результат опроса */}
          <div className="area_survey">
            {showSurveyResult && selectedSurvey && (
              <ResultSurvey
                survey={selectedSurvey}
                onClose={handleCloseSurvey}
                onPrint={() => window.print()}
                onSaveAsWord={() => handleSaveAsWord(selectedSurvey)}
              />
            )}
          </div>

          {/* Список осмотров */}
          <div className="area_inspection_list">
            <h2>Все осмотры</h2>
            {isLoading ? (
              <div className="loading-message">
                <i className="fas fa-spinner fa-spin"></i> Загрузка данных...
              </div>
            ) : surveys.length === 0 ? (
              <div className="empty-message">
                <i className="fas fa-clipboard-list"></i>
                <p>У вас пока нет опросов</p>
              </div>
            ) : (
              <SurveyList
                surveys={surveys}
                onView={handleViewSurvey}
                onDelete={handleDeleteSurvey}
              />
            )}
          </div>
        </div>

        {/* Загрузка изображений и галерея */}
        <div className="formForImageAndResult">
          <ImageUpload 
            onUploadSuccess={handleImageUploadSuccess}
          />
          
          {/* Галерея изображений */}
          <div className="allDownloadImages">
            <h2>Загруженные изображения</h2>
            {images.length === 0 ? (
              <div className="empty-message">
                <i className="fas fa-images"></i>
                <p>Нет загруженных изображений</p>
              </div>
            ) : (
              <ImageGallery
                images={images}
                onView={handleViewImage}
                onDelete={handleDeleteImage}
              />
            )}
          </div>
        </div>

        {/* Модальное окно с изображением */}
        {selectedImage && (
          <div className="visibilityImage" data-div="visibilityImage">
            <div className="blur">
              <div className="imgWithButtonsOrigin">
                <div className="blockVisIMG">
                  <img 
                    className="originImage" 
                    src={`data:image/png;base64,${selectedImage.smallImage}`}
                    alt={selectedImage.fileName}
                    data-img="originfromDB"
                  />
                  <div className="image-info">
                    <p><strong>Файл:</strong> {selectedImage.fileName}</p>
                    <p><strong>Загружено:</strong> {selectedImage.createdAt ? 
                      new Date(selectedImage.createdAt).toLocaleString('ru-RU') : 'Неизвестно'}</p>
                    <p><strong>Комментарий:</strong> {selectedImage.comment || 'Нет комментария'}</p>
                  </div>
                </div>
                <div className="blockButtonsTwo">
                  <button 
                    className="buttonFromTemplateTwo" 
                    type="button"
                    onClick={handleDownloadImage}
                  >
                    <i className="fas fa-download"></i> Скачать
                  </button>
                  <button 
                    className="buttonFromTemplateTwo" 
                    type="button"
                    onClick={handleCloseImage}
                  >
                    <i className="fas fa-times"></i> Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default AccountPage;