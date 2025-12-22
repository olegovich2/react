// src/components/AccountPage/pages/SurveyPage/SurveyPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate} from 'react-router-dom';
import { surveysApi } from '../../../../api/surveys.api';
import { Survey } from '../../types/account.types';
import './SurveyPage.css';

const SurveyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка опроса
  const loadSurvey = useCallback(async () => {
    if (!id || isNaN(parseInt(id))) {
      setError('Некорректный ID опроса');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔍 Загрузка опроса ID: ${id}`);
      
      const result = await surveysApi.getSurveyById(parseInt(id));
      
      if (result.success && result.data) {
        setSurvey(result.data);
        console.log(`✅ Опрос загружен: ${result.data.nameSurname}`);
      } else {
        setError(result.message || 'Опрос не найден');
        console.error('❌ Ошибка загрузки опроса:', result.message);
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка загрузки опроса');
      console.error('❌ Ошибка загрузки опроса:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Сохранение как Word (копируем из SurveyModal)
  const handleSaveAsWord = useCallback(() => {
    if (!survey) return;
    
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

    const titleArray = Array.isArray(survey.title) ? survey.title : (survey.title ? [survey.title] : []);
    const diagnosticArray = survey.diagnostic || [];
    const treatmentArray = survey.treatment || [];
    const guidelinesArray = survey.otherGuidelines || [];

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
        <div class="field-value">${titleArray.join(' ') || "Не указано"}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Обследования:</div>
        <div class="field-value">${createListHTML(diagnosticArray)}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Лечение:</div>
        <div class="field-value">${createListHTML(treatmentArray)}</div>
      </div>
      
      <div class="block">
        <div class="field-label">Рекомендации:</div>
        <div class="field-value">${createListHTML(guidelinesArray)}</div>
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
  }, [survey]);

  // Печать (копируем из SurveyModal)
  const handlePrint = useCallback(() => {
    if (!survey) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Разрешите всплывающие окна для печати");
      return;
    }

    const titleArray = Array.isArray(survey.title) ? survey.title : (survey.title ? [survey.title] : []);
    const diagnosticArray = survey.diagnostic || [];
    const treatmentArray = survey.treatment || [];
    const guidelinesArray = survey.otherGuidelines || [];

    const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Результат опроса - ${survey.date || "Без даты"}</title>
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
      
      <div id="printContent">
        <div class="section">
          <div class="section-title">Основная информация</div>
          <div class="field">
            <span class="field-label">Дата и время:</span>
            <span>${survey.date || "Не указано"}</span>
          </div>
          <div class="field">
            <span class="field-label">ФИО:</span>
            <span>${survey.nameSurname || "Не указано"}</span>
          </div>
          <div class="field">
            <span class="field-label">Возраст:</span>
            <span>${survey.age || "Не указано"}</span>
          </div>
          <div class="field">
            <span class="field-label">Температура:</span>
            <span>${survey.temperature || "Не указано"}</span>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Симптомы</div>
          <p>${survey.anamnesis || "Не указано"}</p>
        </div>
        
        <div class="section">
          <div class="section-title">Диагноз</div>
          <p>${titleArray.join(', ') || "Не указано"}</p>
        </div>
        
        ${diagnosticArray.length > 0 ? `
        <div class="section">
          <div class="section-title">Рекомендуемые обследования</div>
          ${diagnosticArray.map(item => `<div class="list-item">${item}</div>`).join('')}
        </div>
        ` : ''}
        
        ${treatmentArray.length > 0 ? `
        <div class="section">
          <div class="section-title">Рекомендуемое лечение</div>
          ${treatmentArray.map(item => `<div class="list-item">${item}</div>`).join('')}
        </div>
        ` : ''}
        
        ${guidelinesArray.length > 0 ? `
        <div class="section">
          <div class="section-title">Дополнительные рекомендации</div>
          ${guidelinesArray.map(item => `<div class="list-item">${item}</div>`).join('')}
        </div>
        ` : ''}
      </div>
      
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
  }, [survey]);

  // Удаление опроса
  const handleDelete = useCallback(async () => {
    if (!id || !survey) return;
    
    if (!window.confirm(`Вы уверены, что хотите удалить опрос "${survey.nameSurname || 'без имени'}"?`)) {
      return;
    }

    try {
      const result = await surveysApi.deleteSurvey(parseInt(id));
      if (result.success) {
        console.log(`✅ Опрос ${id} удален`);
        navigate('/account');
      } else {
        setError(result.message || 'Ошибка удаления опроса');
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка удаления опроса');
    }
  }, [id, survey, navigate]);

  // Загрузка при монтировании
  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  // Обработка клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          navigate('/account');
          break;
        case 'p':
        case 'з':
          if (e.ctrlKey) handlePrint();
          break;
        case 's':
        case 'ы':
          if (e.ctrlKey) handleSaveAsWord();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, handlePrint, handleSaveAsWord]);

  // Отображение загрузки
  if (isLoading) {
    return (
      <div className="sur-page-account-loading">
        <div className="sur-page-account-spinner">
          <i className="fas fa-spinner fa-spin fa-3x"></i>
        </div>
        <p>Загрузка опроса...</p>
      </div>
    );
  }

  // Отображение ошибки
  if (error || !survey) {
    return (
      <div className="sur-page-account-error">
        <div className="sur-page-account-error-icon">
          <i className="fas fa-exclamation-triangle fa-3x"></i>
        </div>
        <h2>Ошибка загрузки опроса</h2>
        <p>{error || 'Опрос не найден'}</p>
        <div className="sur-page-account-error-actions">
          <button className="buttonFromTemplate" onClick={() => navigate('/account')}>
            <i className="fas fa-arrow-left"></i> Вернуться в аккаунт
          </button>
          <button className="buttonFromTemplate" onClick={loadSurvey}>
            <i className="fas fa-redo"></i> Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sur-page-account-container">
      {/* Шапка страницы */}
      <header className="sur-page-account-header">
        <button 
          className="sur-page-account-back-button"
          onClick={() => navigate('/account')}
          title="Вернуться назад (Esc)"
        >
          <i className="fas fa-arrow-left"></i> Назад
        </button>
        
        <h1 className="sur-page-account-survey-title">
          <i className="fas fa-clipboard-list"></i> Опрос пациента
        </h1>
        
        <div className="sur-page-account-header-actions">
          <button 
            className="sur-page-account-action-button sur-page-account-print-button"
            onClick={handlePrint}
            title="Печать (Ctrl + P)"
          >
            <i className="fas fa-print"></i> Печать
          </button>
          <button 
            className="sur-page-account-action-button sur-page-account-save-button"
            onClick={handleSaveAsWord}
            title="Сохранить как Word (Ctrl + S)"
          >
            <i className="fas fa-file-word"></i> Word
          </button>
          <button 
            className="sur-page-account-action-button sur-page-account-delete-button"
            onClick={handleDelete}
            title="Удалить опрос"
          >
            <i className="fas fa-trash"></i> Удалить
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <div className="sur-page-account-content">
        <div className="sur-page-account-info-panel">
          <div className="sur-page-account-info-section">
            <h3><i className="fas fa-info-circle"></i> Информация об опросе</h3>
            <div className="sur-page-account-info-grid">
              <div className="sur-page-account-info-item">
                <strong>ID:</strong> {survey.id}
              </div>
              <div className="sur-page-account-info-item">
                <strong>Дата и время:</strong> {survey.date || 'Не указано'}
              </div>
              <div className="sur-page-account-info-item">
                <strong>Пациент:</strong> {survey.nameSurname || 'Не указано'}
              </div>
              <div className="sur-page-account-info-item">
                <strong>Возраст:</strong> {survey.age || 'Не указано'}
              </div>
              {survey.temperature && (
                <div className="sur-page-account-info-item">
                  <strong>Температура:</strong> {survey.temperature}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Данные опроса */}
        <div className="sur-page-account-data-container">
          {/* Симптомы */}
          <div className="sur-page-account-survey-section">
            <h3><i className="fas fa-stethoscope"></i> Симптомы</h3>
            <div className="sur-page-account-section-content">
              {survey.anamnesis || "Не указано"}
            </div>
          </div>

          {/* Диагноз */}
          <div className="sur-page-account-survey-section">
            <h3><i className="fas fa-diagnoses"></i> Диагноз</h3>
            <div className="sur-page-account-section-content">
              {Array.isArray(survey.title) ? survey.title.join(', ') : survey.title || "Не указано"}
            </div>
          </div>

          {/* Обследования */}
          {survey.diagnostic && survey.diagnostic.length > 0 && (
            <div className="sur-page-account-survey-section">
              <h3><i className="fas fa-search"></i> Рекомендуемые обследования</h3>
              <div className="sur-page-account-section-content">
                <ul>
                  {survey.diagnostic.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Лечение */}
          {survey.treatment && survey.treatment.length > 0 && (
            <div className="sur-page-account-survey-section">
              <h3><i className="fas fa-pills"></i> Рекомендуемое лечение</h3>
              <div className="sur-page-account-section-content">
                <ul>
                  {survey.treatment.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Дополнительные рекомендации */}
          {survey.otherGuidelines && survey.otherGuidelines.length > 0 && (
            <div className="sur-page-account-survey-section">
              <h3><i className="fas fa-comment-medical"></i> Дополнительные рекомендации</h3>
              <div className="sur-page-account-section-content">
                <ul>
                  {survey.otherGuidelines.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>        
      </div>
    </div>
  );
};

SurveyPage.displayName='SurveyPage';

export default SurveyPage;