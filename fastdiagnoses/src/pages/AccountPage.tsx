import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Layout/Header";
import Footer from "../components/Layout/Footer";
import SurveyList from "../components/Account/SurveyList";
import ImageUpload from "../components/Account/ImageUpload";
import ImageGallery from "../components/Account/ImageGallery";
import ResultSurvey from "../components/Account/ResultSurvey";

import { getUserSurveys, deleteSurvey } from "../api/surveys.api";
import { deleteImage } from "../api/images.api";
import { Survey, UploadedImage } from "../types/api.types";

interface AccountSurvey extends Survey {
  id: number;
}

const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);  
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
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        if (!user.login) {
          navigate("/login");
          return;
        }

        const surveyResult = await getUserSurveys(user.login);

        if (surveyResult.success && surveyResult.data) {
          // Устанавливаем опросы
          if (surveyResult.data.surveys) {
            const formattedSurveys = surveyResult.data.surveys.map(
              (survey: any, index: number) => {
                const surveyData = survey.survey ? survey.survey : survey;

                return {
                  id: survey.id || index + 1,
                  date: surveyData.date || survey.date || "",
                  nameSurname: surveyData.nameSurname || "",
                  age: surveyData.age || "",
                  temperature: surveyData.temperature || "",
                  anamnesis: surveyData.anamnesis || "",
                  title: Array.isArray(surveyData.title) ? surveyData.title : [],
                  diagnostic: Array.isArray(surveyData.diagnostic) ? surveyData.diagnostic : [],
                  treatment: Array.isArray(surveyData.treatment) ? surveyData.treatment : [],
                  otherGuidelines: Array.isArray(surveyData.otherGuidelines) ? surveyData.otherGuidelines : [],
                } as AccountSurvey;
              }
            );
            setSurveys(formattedSurveys);
          }
          
          // Устанавливаем изображения
          if (surveyResult.data.images) {
            setImages(surveyResult.data.images);
          }
        }
      } catch (error) {
        console.error("Ошибка загрузки данных:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccountData();
  }, [navigate, refreshTrigger]);

  // 🔧 Обновление данных после загрузки изображения
  const handleImageUploadSuccess = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // 🔧 Просмотр опроса
  const handleViewSurvey = useCallback((survey: AccountSurvey) => {
    setSelectedSurvey(survey);
    setShowSurveyResult(true);
  }, []);

  // 🔧 Удаление опроса
  const handleDeleteSurvey = useCallback(async (id: number) => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.login) {
        navigate("/login");
        return;
      }

      const result = await deleteSurvey(user.login, id);
      if (result.success) {        
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error("Ошибка удаления опроса:", error);
    }
  }, [navigate]);

  // 🔧 Просмотр изображения
  const handleViewImage = useCallback((imageId: number) => {
    const image = images.find((img) => img.id === imageId);
    if (image) {
      setSelectedImage(image);
    }
  }, [images]);

  // 🔧 Удаление изображения
  const handleDeleteImage = useCallback(async (imageId: number) => {
    try {
      // Закрываем модальное окно если удаляем текущее изображение
      if (selectedImage?.id === imageId) {
        setSelectedImage(null);
      }
      
      const result = await deleteImage(imageId);
      if (result.success) {
        // Обновляем список изображений локально для мгновенной обратной связи
        setImages(prev => prev.filter(img => img.id !== imageId));
        // Затем обновляем данные с сервера
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error("Ошибка удаления изображения:", error);
    }
  }, [selectedImage]);

  // 🔧 Определение MIME типа по расширению файла
  const getMimeType = useCallback((filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      case 'tiff':
      case 'tif':
        return 'image/tiff';
      default:
        return 'image/jpeg';
    }
  }, []);

  // 🔧 Скачивание изображения
  const handleDownloadImage = useCallback(() => {
    if (selectedImage && selectedImage.originIMG) {
      const mimeType = getMimeType(selectedImage.fileName);
      
      const link = document.createElement("a");
      link.href = `data:${mimeType};base64,${selectedImage.originIMG}`;
      link.download = selectedImage.fileName;
      
      // Очищаем после скачивания
      link.onload = () => {
        URL.revokeObjectURL(link.href);
      };
      
      link.click();
    }
  }, [selectedImage, getMimeType]);

  // 🔧 Закрытие опроса
  const handleCloseSurvey = useCallback(() => {
    setShowSurveyResult(false);
    setSelectedSurvey(null);
  }, []);

  // 🔧 Закрытие изображения
  const handleCloseImage = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // 🔧 Сохранение как Word
  const handleSaveAsWord = useCallback((survey: AccountSurvey) => {
    let dateStr = "";
    try {
      if (survey.date) {
        const rawDate = survey.date.trim();
        const dateMatch = rawDate.match(/\d{2}\/\d{2}\/\d{4}/) || rawDate.match(/\d{2}\.\d{2}\.\d{4}/);
        if (dateMatch) {
          dateStr = dateMatch[0].replace(/\//g, "_").replace(/\./g, "_");
        } else if (rawDate) {
          dateStr = rawDate.substring(0, 20).replace(/[^\wа-яА-Я]/g, "_");
        }
      }
    } catch (error) {
      console.warn("Не удалось извлечь дату:", error);
    }

    const createListHTML = (items: string[] | undefined) => {
      if (!items || items.length === 0) return "Не указано";
      if (items.length === 1) return items[0];
      const listItems = items.map((item) => `<li>${item}</li>`).join("");
      return `<ul>${listItems}</ul>`;
    };

    const content = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Результат опроса</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0;
          line-height: 1.3;
          color: black;
        }
        h1, h2, h3 {
          text-align: center;
          margin: 0;
          font-weight: bold;
        }
        h1 { font-size: 18pt; }
        h2 { font-size: 14pt; }
        .block {
          margin-bottom: 10px;
        }
        .field-label {
          font-weight: bold;
          display: block;
          margin-bottom: 3px;
        }
        .field-value {
          margin: 0;
        }
        ul {
          margin: 2px 0;
          padding: 0;
        }
        li {
          margin-bottom: 3px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #000;
          font-size: 9pt;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px;">
        <h1>РЕЗУЛЬТАТ МЕДИЦИНСКОГО ОПРОСА</h1>        
      </div>
      
      <div class="block">
        <div class="field-label">Дата и время:</div>
        <div class="field-value">${survey.date || "Не указано"}</div>
      </div>
      
      <div class="block">
        <div class="field-label">ФИО:</div>
        <div class="field-value">${survey.nameSurname || "Не указано"}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Возраст:</div>
        <div class="field-value">${survey.age || "Не указано"}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Температура:</div>
        <div class="field-value">${survey.temperature || "Не указано"}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Симптомы:</div>
        <div class="field-value">${survey.anamnesis || "Не указано"}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Диагноз:</div>
        <div class="field-value">${survey.title.join(' ')}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Обследования:</div>
        <div class="field-value">${createListHTML(survey.diagnostic)}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Лечение:</div>
        <div class="field-value">${createListHTML(survey.treatment)}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Рекомендации:</div>
        <div class="field-value">${createListHTML(survey.otherGuidelines)}</div>
      </div>
      
      <div style="margin-top: 30px; padding: 10px; border: 1px solid black; font-size: 9pt;">
        <strong>ВНИМАНИЕ:</strong> Предварительное заключение. Для точной диагностики обратитесь к врачу.
      </div>
      
      <div class="footer">
        QuickDiagnosis • ${new Date().getFullYear()} • Сгенерировано: ${new Date().toLocaleString("ru-RU")}
      </div>
    </body>
    </html>
  `;

    const source = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(content);
    const fileDownload = document.createElement("a");
    fileDownload.href = source;
    fileDownload.download = dateStr ? `Опрос_${dateStr}.doc` : `Опрос.doc`;

    document.body.appendChild(fileDownload);
    fileDownload.click();
    document.body.removeChild(fileDownload);
  }, []);

  // 🔧 Печать
  const handlePrint = useCallback(() => {
    if (!selectedSurvey) return;

    const printContent = document.getElementById("printFromAccount");
    if (!printContent) {
      console.error("Элемент для печати не найден");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Разрешите всплывающие окна для печати");
      return;
    }

    const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Результат опроса - ${selectedSurvey.date || "Без даты"}</title>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          line-height: 1.5;
          color: #000;
        }
        .print-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .print-header h1 {
          color: #2c3e50;
          margin: 0 0 10px 0;
          font-size: 24pt;
        }
        .print-header h2 {
          color: #7f8c8d;
          margin: 10px 0;
          font-size: 18pt;
        }
        .section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .section-title {
          font-weight: bold;
          color: #34495e;
          font-size: 14pt;
          margin-bottom: 10px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        .field {
          margin-bottom: 8px;
        }
        .field-label {
          font-weight: bold;
          min-width: 200px;
          display: inline-block;
        }
        .list-item {
          margin: 3px 0;
          padding-left: 15px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 10pt;
          text-align: center;
        }
        .print-button {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 10px 20px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        @media print {
          .print-button {
            display: none;
          }
          @page {
            margin: 2cm;
          }
          body {
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-header">
        <h1>QUICK DIAGNOSIS</h1>
        <h2>Результат медицинского опроса</h2>
        <p>Дата генерации отчета: ${new Date().toLocaleString("ru-RU")}</p>
      </div>
      
      ${printContent.innerHTML}
      
      <div class="footer">
        <p>Сгенерировано системой QuickDiagnosis</p>
        <p>Предварительное заключение. Для точной диагностики обратитесь к врачу.</p>
      </div>
      
      <button class="print-button" onclick="window.print();">
        🖨️ Печатать
      </button>
    </body>
    </html>
  `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
  }, [selectedSurvey]);

  return (
    <div className="general">
      <Header showBackButton={true} />

      <main className="general">
        <div className="mainAccount">
          <div className="area_survey">
            {showSurveyResult && selectedSurvey && (
              <ResultSurvey
                survey={selectedSurvey}
                onClose={handleCloseSurvey}
                onPrint={handlePrint}
                onSaveAsWord={() => handleSaveAsWord(selectedSurvey)}
              />
            )}
          </div>

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

        <div className="formForImageAndResult">
          <ImageUpload onUploadSuccess={handleImageUploadSuccess} />

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

        {/* Модальное окно с оригинальным изображением */}
        {selectedImage && (
          <div className="visibilityImage" onClick={handleCloseImage}>
            <div className="blur"></div>
            
            <div className="imgWithButtonsOrigin" onClick={(e) => e.stopPropagation()}>
              <div className="blockVisIMG">
                <img
                  className="originImage"
                  src={`data:${getMimeType(selectedImage.fileName)};base64,${selectedImage.originIMG}`}
                  alt={selectedImage.fileName}
                  title={selectedImage.fileName}
                />
                
                <div className="image-info">
                  <p><strong>📁 Файл:</strong> {selectedImage.fileName}</p>
                  <p>
                    <strong>📏 Размер:</strong> {selectedImage.originIMG 
                      ? `${Math.round(selectedImage.originIMG.length * 3 / 4 / 1024)} KB` 
                      : 'Миниатюра (100x100px)'}
                  </p>
                  <p>
                    <strong>💬 Комментарий:</strong> {selectedImage.comment || "Нет комментария"}
                  </p>
                </div>
              </div>
              
              <div className="blockButtonsTwo">
                <button
                  className="buttonFromTemplateTwo"
                  type="button"
                  onClick={handleDownloadImage}
                  title="Скачать оригинальное изображение"
                >
                  <i className="fas fa-download"></i> 
                  Скачать оригинальное изображение
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
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AccountPage;