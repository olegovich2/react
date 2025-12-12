import React from 'react';
import { Survey } from '../../types/api.types';
import { saveSurveyToDB } from '../../api/surveys.api';

interface ResultSurveyProps {
  survey: Survey;
  onClose: () => void;
  onSaveToAccount: (survey: Survey) => Promise<void>;
}

const ResultSurvey: React.FC<ResultSurveyProps> = ({ survey, onClose, onSaveToAccount }) => {
  const handlePrint = () => {
    const printContent = document.getElementById('print');
    if (printContent) {
      const printWindow = window.open('', '', 'left=50,top=50,width=800,height=640,toolbar=0,scrollbars=1,status=0');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Результат опроса</title></head><body>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    }
  };

  const handleSaveAsWord = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' " +
      "xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
    const footer = "</body></html>";
    
    const docSave = document.getElementById('print');
    if (docSave) {
      const sourceHTML = header + docSave.innerHTML + footer;
      const date = survey.date.split(', ').join('_');
      const source = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement('a');
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `Результат_опроса_от_${date}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
    }
  };

  const handleSaveToAccount = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.login) {
        alert('Пользователь не найден');
        return;
      }

      const result = await saveSurveyToDB(user.login, JSON.stringify(survey));

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