import React, { useCallback } from 'react';
import { Survey } from '../../AccountPage/types/account.types';
import { saveSurveyToDB } from '../../../api/surveys.api';
import './ResultSurveyMain.css'

interface ResultSurveyProps {
  survey: Survey;
  onClose: () => void;
  onSaveToAccount: (survey: Survey) => Promise<void>;
}

const ResultSurveyMain: React.FC<ResultSurveyProps> = ({ survey, onClose, onSaveToAccount }) => {
  // 🔧 Функция печати из эталонного SurveyPage.tsx
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

  // 🔧 Функция сохранения как Word из эталонного SurveyPage.tsx
  const handleSaveAsWord = useCallback(() => {
    if (!survey) return;
    
    let dateStr = "";
    try {
      if (survey.date) {
        const rawDate = survey.date.trim();
        const dateMatch = rawDate.match(/\d{2}\/\d{2}\/\d{4}/) || rawDate.match(/\d{2}\.\d{2}\/\d{4}/);
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

  const handleSaveToAccount = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.login) {
        alert('Пользователь не найден');
        return;
      }

      const result = await saveSurveyToDB(survey);

      if (result.success) {
        alert('Данные успешно записаны и отобразятся в личном кабинете');
      } else {
        alert(result.message || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Ошибка при сохранении:', error);
      alert('Произошла ошибка при сохранении');
    }
  };

  return (
    <div className="surv-main-container">
      {/* Основной контент */}
      <div className="surv-main-content">
        {/* Панель информации - без ID */}
        <div className="surv-main-info-panel">
          <div className="surv-main-info-section">
            <h3><i className="fas fa-info-circle"></i> Информация об опросе</h3>
            <div className="surv-main-info-grid">
              <div className="surv-main-info-item">
                <strong>Дата и время:</strong> {survey.date || 'Не указано'}
              </div>
              <div className="surv-main-info-item">
                <strong>Пациент:</strong> {survey.nameSurname || 'Не указано'}
              </div>
              <div className="surv-main-info-item">
                <strong>Возраст:</strong> {survey.age || 'Не указано'}
              </div>
              {survey.temperature && (
                <div className="surv-main-info-item">
                  <strong>Температура:</strong> {survey.temperature}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Данные опроса */}
        <div className="surv-main-data-container" id="print">
          {/* Симптомы */}
          <div className="surv-main-survey-section">
            <h3><i className="fas fa-stethoscope"></i> Симптомы</h3>
            <div className="surv-main-section-content">
              {survey.anamnesis || "Не указано"}
            </div>
          </div>

          {/* Диагноз */}
          <div className="surv-main-survey-section">
            <h3><i className="fas fa-diagnoses"></i> Диагноз</h3>
            <div className="surv-main-section-content">
              {Array.isArray(survey.title) ? survey.title.join(' ') : survey.title || "Не указано"}
            </div>
          </div>

          {/* Обследования */}
          {survey.diagnostic && survey.diagnostic.length > 0 && (
            <div className="surv-main-survey-section">
              <h3><i className="fas fa-search"></i> Рекомендуемые обследования</h3>
              <div className="surv-main-section-content">
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
            <div className="surv-main-survey-section">
              <h3><i className="fas fa-pills"></i> Рекомендуемое лечение</h3>
              <div className="surv-main-section-content">
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
            <div className="surv-main-survey-section">
              <h3><i className="fas fa-comment-medical"></i> Дополнительные рекомендации</h3>
              <div className="surv-main-section-content">
                <ul>
                  {survey.otherGuidelines.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="surv-main-actions">
          <button 
            className="surv-main-action-button surv-main-print-button"
            onClick={handlePrint}
          >
            <i className="fas fa-print"></i> Печать
          </button>
          <button 
            className="surv-main-action-button surv-main-save-account-button"
            onClick={handleSaveToAccount}
          >
            <i className="fas fa-save"></i> Сохранить в аккаунте
          </button>
          <button 
            className="surv-main-action-button surv-main-save-word-button"
            onClick={handleSaveAsWord}
          >
            <i className="fas fa-file-word"></i> Сохранить как Word
          </button>
          <button 
            className="surv-main-action-button surv-main-close-button"
            onClick={onClose}
          >
            <i className="fas fa-times"></i> Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

ResultSurveyMain.displayName = 'ResultSurveyMain';

export default ResultSurveyMain;