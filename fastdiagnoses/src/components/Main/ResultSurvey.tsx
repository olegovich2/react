import React from 'react';
import { Survey } from '../../components/AccountPage/types/account.types';
import { saveSurveyToDB } from '../../api/surveys.api';

interface ResultSurveyProps {
  survey: Survey;
  onClose: () => void;
  onSaveToAccount: (survey: Survey) => Promise<void>;
}

const ResultSurvey: React.FC<ResultSurveyProps> = ({ survey, onClose, onSaveToAccount }) => {
// 🔧 Улучшенная печать без перезагрузки страницы
const handlePrint = () => {
  const printContent = document.getElementById('print');
  if (!printContent) {
    console.error('Элемент для печати не найден');
    return;
  }

  // Создаем отдельное окно для печати
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Пожалуйста, разрешите всплывающие окна для печати');
    return;
  }

  // Клонируем содержимое, чтобы не повредить оригинал
  const printClone = printContent.cloneNode(true) as HTMLElement;
  
  // Удаляем кнопки из клона (если есть)
  const buttons = printClone.querySelectorAll('button, .no-print');
  buttons.forEach(button => button.remove());

  // Создаем HTML для печати
  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Результат опроса - QuickDiagnosis</title>
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
        .print-date {
          color: #95a5a6;
          font-size: 12pt;
          margin-top: 10px;
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
        <p class="print-date">Дата генерации отчета: ${new Date().toLocaleString('ru-RU')}</p>
      </div>
      
      <div id="print-content">
        ${printClone.innerHTML}
      </div>
      
      <div class="footer">
        <p>Сгенерировано системой QuickDiagnosis</p>
        <p>Предварительное заключение. Для точной диагностики обратитесь к врачу.</p>
      </div>
      
      <button class="print-button" onclick="window.print();">
        🖨️ Печатать
      </button>
      
      <script>
        // Автоматически открываем диалог печати
        window.onload = function() {
          setTimeout(() => {
            window.print();
          }, 300);
        };
        
        // Закрываем окно после печати (опционально)
        window.onafterprint = function() {
          setTimeout(() => {
            window.close();
          }, 100);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(printHtml);
  printWindow.document.close();
};

  const handleSaveAsWord = () => {
  const docSave = document.getElementById('print');
  if (!docSave) {
    console.error('Элемент для сохранения не найден');
    return;
  }

  // Клонируем содержимое
  const contentClone = docSave.cloneNode(true) as HTMLElement;
  
  // Удаляем кнопки
  const buttons = contentClone.querySelectorAll('button');
  buttons.forEach(button => button.remove());

  // Форматируем дату для имени файла
  let dateStr = 'без_даты';
  try {
    const dateElement = contentClone.querySelector('[data-account="dateAndTime"]');
    if (dateElement && dateElement.textContent) {
      const rawDate = dateElement.textContent.trim();
      // Пробуем разные форматы даты
      const dateMatch = rawDate.match(/\d{2}\/\d{2}\/\d{4}/) || 
                       rawDate.match(/\d{2}\.\d{2}\.\d{4}/);
      if (dateMatch) {
        dateStr = dateMatch[0].replace(/\//g, '_').replace(/\./g, '_');
      } else if (rawDate) {
        // Берем первые 20 символов для имени файла
        dateStr = rawDate.substring(0, 20).replace(/[^\wа-яА-Я]/g, '_');
      }
    }
  } catch (error) {
    console.warn('Не удалось извлечь дату:', error);
  }

  // Минималистичный HTML для печати
  const content = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Результат опроса ${dateStr}</title>
      <style>
        /* Минимальные стили для печати */
        body { 
          font-family: Arial, sans-serif; 
          margin: 2cm;
          line-height: 1.3;
          color: black;
        }
        /* Заголовок */
        h1, h2, h3 {
          text-align: center;
          margin: 0 0 10px 0;
          font-weight: bold;
        }
        h1 { font-size: 18pt; }
        h2 { font-size: 14pt; }
        /* Блоки */
        .block {
          margin-bottom: 15px;
        }
        .field-label {
          font-weight: bold;
          display: block;
          margin-bottom: 3px;
        }
        .field-value {
          margin: 0 0 10px 15px;
        }
        /* Списки */
        ul {
          margin: 5px 0 5px 20px;
          padding: 0;
        }
        li {
          margin-bottom: 3px;
        }
        /* Подвал */
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #000;
          font-size: 9pt;
          text-align: center;
        }
        /* Разделители */
        hr {
          border: none;
          border-top: 1px solid #ccc;
          margin: 20px 0;
        }
        /* Убираем лишнее */
        .no-print {
          display: none;
        }
      </style>
    </head>
    <body>
      <!-- Заголовок -->
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px;">
        <h1>РЕЗУЛЬТАТ МЕДИЦИНСКОГО ОПРОСА</h1>
        <div style="font-size: 11pt; margin: 5px 0;">
          Дата документа: ${new Date().toLocaleDateString('ru-RU')}
        </div>
      </div>
      
      <!-- Основной контент -->
      <div id="content">
        ${contentClone.innerHTML}
      </div>
      
      <!-- Предупреждение -->
      <div style="margin-top: 30px; padding: 10px; border: 1px solid black; font-size: 9pt;">
        <strong>ВНИМАНИЕ:</strong> Предварительное заключение. Для точной диагностики обратитесь к врачу.
      </div>
      
      <!-- Подвал -->
      <div class="footer">
        QuickDiagnosis • ${new Date().getFullYear()} • Сгенерировано: ${new Date().toLocaleString('ru-RU')}
      </div>
      
      <script>
        // Минимальное форматирование для печати
        document.addEventListener('DOMContentLoaded', function() {
          // 1. Добавляем метки к полям
          const fields = [
            { selector: '[data-account="dateAndTime"]', label: 'Дата и время:' },
            { selector: '[data-account="name"]', label: 'ФИО:' },
            { selector: '[data-account="age"]', label: 'Возраст:' },
            { selector: '[data-account="temperature"]', label: 'Температура:' }
          ];
          
          fields.forEach(field => {
            const element = document.querySelector(field.selector);
            if (element && element.parentElement) {
              const label = document.createElement('div');
              label.className = 'field-label';
              label.textContent = field.label;
              element.parentElement.insertBefore(label, element);
            }
          });
          
          // 2. Оборачиваем описательные блоки
          const descriptiveBlocks = [
            { selector: '[data-account="overview"]', label: 'Симптомы:' },
            { selector: '[data-account="listDiagnosis"]', label: 'Диагноз:' },
            { selector: '[data-account="diagnostics"]', label: 'Обследования:' },
            { selector: '[data-account="treatment"]', label: 'Лечение:' },
            { selector: '[data-account="volumeOfLiquid"]', label: 'Рекомендации:' }
          ];
          
          descriptiveBlocks.forEach(block => {
            const element = document.querySelector(block.selector);
            if (element && element.parentElement) {
              const wrapper = document.createElement('div');
              wrapper.className = 'block';
              
              const label = document.createElement('div');
              label.className = 'field-label';
              label.textContent = block.label;
              wrapper.appendChild(label);
              
              const value = document.createElement('div');
              value.className = 'field-value';
              value.innerHTML = element.innerHTML;
              wrapper.appendChild(value);
              
              element.parentElement.replaceChild(wrapper, element.parentElement);
            }
          });
          
          // 3. Преобразуем запятые в списки для удобства чтения
          const listFields = ['listDiagnosis', 'diagnostics', 'treatment'];
          listFields.forEach(fieldName => {
            const element = document.querySelector('[data-account="' + fieldName + '"] .field-value');
            if (element && element.textContent && element.textContent.includes(',')) {
              const items = element.textContent.split(',').map(item => item.trim()).filter(item => item);
              if (items.length > 1) {
                const list = document.createElement('ul');
                items.forEach(item => {
                  const li = document.createElement('li');
                  li.textContent = item;
                  list.appendChild(li);
                });
                element.innerHTML = '';
                element.appendChild(list);
              }
            }
          });
        });
      </script>
    </body>
    </html>
  `;
  
  // Создаем и скачиваем файл
  const source = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(content);
  const fileDownload = document.createElement('a');
  fileDownload.href = source;
  fileDownload.download = `Опрос_${dateStr}.doc`;
  
  document.body.appendChild(fileDownload);
  fileDownload.click();
  document.body.removeChild(fileDownload);
};

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
    <div className="result" id="result" data-result="resultSurvey">
      <div id="print">
        <div className="header_for_print">
          <h1>QUICK DIAGNOSIS</h1>
        </div>
        <h2>Результат опроса</h2>
        
        <div className="content_survey">
          Дата и время:
          <p data-result="dateAndTime">{survey.date}</p>
        </div>
        
        <div className="content_survey">
          Фамилия Имя Отчество:
          <p data-result="name">{survey.nameSurname}</p>
        </div>
        
        <div className="content_survey">
          Возраст:
          <p data-result="age">{survey.age}</p>
        </div>
        
        <div className="content_survey">
          Температура:
          <p data-result="temperature">{survey.temperature}</p>
        </div>
        
        <div className="many_content_survey">
          Описание симптомов:
          <p data-result="overview">{survey.anamnesis}</p>
        </div>
        
        <div className="many_content_survey">
          Предварительный диагноз:
          <p data-result="listDiagnosis">{survey.title.join(' ')}</p>
        </div>
        
        <div className="many_content_survey">
          Рекомендации по обследованию:
          <p data-result="diagnostics">{survey.diagnostic?.join(', ') || 'Нет рекомендаций'}</p>
        </div>
        
        <div className="many_content_survey">
          Рекомендации по лечению до обращения к врачу:
          <p data-result="treatment">{survey.treatment?.join(', ') || 'Нет рекомендаций'}</p>
        </div>
        
        <div className="many_content_survey">
          Дополнительные рекомендации:
          <p data-result="volumeOfLiquid">{survey.otherGuidelines?.join(' ') || 'Нет рекомендаций'}</p>
        </div>
      </div>
      
      <div>
        <button className="buttonFromAnamnesis" type="button" data-button="print" onClick={handlePrint}>
          Печать
        </button>
        
        <button className="buttonFromAnamnesis" type="button" data-button="saveData" onClick={handleSaveToAccount}>
          Сохранить в Личном кабинете
        </button>
        
        <button className="buttonFromAnamnesis" type="button" data-button="saveAs" onClick={handleSaveAsWord}>
          Сохранить как Word
        </button>
        
        <button className="buttonFromAnamnesis" type="button" data-button="closeResultSurvey" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
};

export default ResultSurvey;