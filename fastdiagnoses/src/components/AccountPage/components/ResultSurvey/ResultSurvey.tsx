import React from 'react';
import { Survey } from '../../types/account.types';
import './ResultSurvey.css'

interface ResultSurveyProps {
  survey: Survey;
  onClose: () => void;
  onPrint: () => void;
  onSaveAsWord: () => void;
}

const ResultSurvey: React.FC<ResultSurveyProps> = ({ survey, onClose, onPrint, onSaveAsWord }) => {
  console.log('jnhf,jnfkjhsdbclkjshd', survey);
  
  return (
    <div data-account="resultSurvey">
      <div id="printFromAccount">
        <div className="header_for_print">
          <h2>QUICK DIAGNOSIS</h2>
        </div>
        <h2>Результат опроса</h2>
        
        <div className="content_survey">
          Дата и время:
          <p data-account="dateAndTime">{survey.date}</p>
        </div>
        
        <div className="content_survey">
          Фамилия Имя Отчество:
          <p data-account="name">{survey.nameSurname}</p>
        </div>
        
        <div className="content_survey">
          Возраст:
          <p data-account="age">{survey.age}</p>
        </div>
        
        <div className="content_survey">
          Температура:
          <p data-account="temperature">{survey.temperature}</p>
        </div>
        
        <div className="many_content_survey">
          Описание симптомов:
          <p data-account="overview">{survey.anamnesis}</p>
        </div>
        
        <div className="many_content_survey">
          Предварительный диагноз:
          <p data-account="listDiagnosis">{survey.title?.join(', ')}</p>
        </div>
        
        <div className="many_content_survey">
          Рекомендации по обследованию:
          <p data-account="diagnostics">{survey.diagnostic?.join(', ') || 'Нет рекомендаций'}</p>
        </div>
        
        <div className="many_content_survey">
          Рекомендации по лечению до обращения к врачу:
          <p data-account="treatment">{survey.treatment?.join(', ') || 'Нет рекомендаций'}</p>
        </div>
        
        <div className="many_content_survey">
          Дополнительные рекомендации:
          <p data-account="volumeOfLiquid">{survey.otherGuidelines?.join(' ') || 'Нет рекомендаций'}</p>
        </div>
      </div>
      
      <button className="buttonFromAnamnesis" type="button" data-account="print" onClick={onPrint}>
        Печать
      </button>
      
      <button className="buttonFromAnamnesis" type="button" data-account="closeResultSurvey" onClick={onClose}>
        Закрыть
      </button>
      
      <button className="buttonFromAnamnesis" type="button" data-account="saveAs" onClick={onSaveAsWord}>
        Сохранить как Word
      </button>
    </div>
  );
};

export default ResultSurvey;