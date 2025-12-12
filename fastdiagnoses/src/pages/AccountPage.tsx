import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import SurveyList from '../components/Account/SurveyList';
import ImageUpload from '../components/Account/ImageUpload';
import ImageGallery from '../components/Account/ImageGallery';
import ResultSurvey from '../components/Account/ResultSurvey';
import { useWebSocket } from '../context/WebSocketContext';
import { getUserSurveys, deleteSurvey } from '../api/surveys.api';
import { getOriginalImage } from '../api/images.api';
import { Survey, ImageData } from '../types/api.types';

const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { sendMessage, isConnected } = useWebSocket();
  
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [showSurveyResult, setShowSurveyResult] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressBarContainerRef = useRef<HTMLDivElement>(null);

  // 🔧 Функция обработки данных из API
  const processSurveyData = (data: any) => {
    const surveysList: Survey[] = [];
    const imagesList: ImageData[] = [];

    // Обработка опросов
    if (data.surveys) {
      Object.keys(data.surveys).forEach(key => {
        const survey = JSON.parse(data.surveys[key]);
        surveysList.push({
          ...survey,
          id: key,
        });
      });
    }

    // Обработка изображений
    if (data.images) {
      Object.keys(data.images).forEach(key => {
        imagesList.push({
          id: key,
          ...data.images[key],
        });
      });
    }

    return { surveys: surveysList, images: imagesList };
  };

  // 🔧 Функция конвертации ArrayBuffer в Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // 🔧 Основной эффект загрузки данных
  useEffect(() => {
    const loadAccountData = async () => {
      setIsLoading(true);
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.login) {
          navigate('/login');
          return;
        }

        const result = await getUserSurveys(user.login);
        
        if (result.success && result.data) {
          const { surveys, images } = processSurveyData(result.data);
          setSurveys(surveys);
          setImages(images);
          localStorage.setItem('allSurveys', JSON.stringify(surveys));
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccountData();
    
    // Очистка localStorage при размонтировании
    return () => {
      localStorage.removeItem('allSurveys');
      localStorage.removeItem('originImage');
    };
  }, [navigate]);

  // 🔧 Обработчики событий
  const handleViewSurvey = (survey: Survey) => {
    setSelectedSurvey(survey);
    setShowSurveyResult(true);
  };

  const handleDeleteSurvey = async (id: string) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const result = await deleteSurvey(user.login, id);
      
      if (result.success) {
        // Перезагружаем данные
        const refreshResult = await getUserSurveys(user.login);
        if (refreshResult.success && refreshResult.data) {
          const { surveys, images } = processSurveyData(refreshResult.data);
          setSurveys(surveys);
          setImages(images);
          localStorage.setItem('allSurveys', JSON.stringify(surveys));
        }
        
        if (selectedSurvey?.id === id) {
          setSelectedSurvey(null);
          setShowSurveyResult(false);
        }
      }
    } catch (error) {
      console.error('Ошибка удаления опроса:', error);
    }
  };

  const handleViewImage = async (imageId: string) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const result = await getOriginalImage(user.login, imageId);
      
      if (result.success && result.data) {
        setSelectedImage(result.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    await handleDeleteSurvey(imageId);
  };

  const handleImageUpload = async (file: File, comment: string) => {
    if (!isConnected) {
      alert('WebSocket не подключен');
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const websocketId = Date.now().toString();

    // Чтение файла
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        const fileData = e.target.result as ArrayBuffer;
        
        // Подготовка объекта для отправки
        const uploadData = {
          websocketid: websocketId,
          filename: file.name,
          comment: comment,
          file: arrayBufferToBase64(fileData),
        };

        // Инициализация WebSocket соединения
        sendMessage({
          type: 'initUpload',
          login: user.login,
          websocketId: websocketId,
          data: uploadData,
        });

        // Показать прогресс бар
        if (progressBarContainerRef.current) {
          progressBarContainerRef.current.classList.remove('unvisible');
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCloseSurvey = () => {
    setShowSurveyResult(false);
    setSelectedSurvey(null);
  };

  const handleCloseImage = () => {
    setSelectedImage(null);
  };

  const handleDownloadImage = () => {
    if (selectedImage) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${selectedImage.originIMG}`;
      link.download = selectedImage.fileNameOriginIMG;
      link.click();
    }
  };

  // 🔧 Функция для сохранения как Word
  const handleSaveAsWord = (survey: Survey) => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' " +
      "xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>Результат опроса</title></head><body>";
    const footer = "</body></html>";
    
    const date = survey.date.split(', ').join('_');
    const source = "data:application/vnd.ms-word;charset=utf-8," + 
      encodeURIComponent(header + document.getElementById('printFromAccount')?.innerHTML + footer);
    
    const fileDownload = document.createElement('a');
    fileDownload.href = source;
    fileDownload.download = `Результат_опроса_от_${date}.doc`;
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
              <div>Загрузка...</div>
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
          <ImageUpload onUpload={handleImageUpload} />
          
          {/* Прогресс бар */}
          <div className="progress-bar unvisible" ref={progressBarContainerRef}>
            <div className="progress-bar-inner" ref={progressBarRef}></div>
          </div>
          
          {/* Галерея изображений */}
          <div className="allDownloadImages">
            <ImageGallery
              images={images}
              onView={handleViewImage}
              onDelete={handleDeleteImage}
            />
          </div>
        </div>

        {/* Модальное окно с оригинальным изображением */}
        {selectedImage && (
          <div className="visibilityImage" data-div="visibilityImage">
            <div className="blur">
              <div className="imgWithButtonsOrigin">
                <div className="blockVisIMG">
                  <img 
                    className="originImage" 
                    src={`data:image/png;base64,${selectedImage.originIMG}`}
                    alt={selectedImage.fileNameOriginIMG}
                    data-img="originfromDB"
                  />
                </div>
                <div className="blockButtonsTwo">
                  <button 
                    className="buttonFromTemplateTwo" 
                    type="button"
                    onClick={handleDownloadImage}
                  >
                    Загрузить
                  </button>
                  <button 
                    className="buttonFromTemplateTwo" 
                    type="button"
                    onClick={handleCloseImage}
                  >
                    Закрыть
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