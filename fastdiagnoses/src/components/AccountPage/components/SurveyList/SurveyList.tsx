import React from 'react';
import { Survey } from '../../types/account.types';

interface SurveyListProps {
  surveys: Survey[];
  onView: (survey: Survey) => void;
  onDelete: (id: number) => void;
}

const SurveyList: React.FC<SurveyListProps> = ({ surveys, onView, onDelete }) => {  
  if (surveys.length === 0) {
    return <div>Нет сохраненных опросов</div>;
  }

  return (
    <div className="survey-list-container" data-container="allSurveyFromDB">
      {surveys.map((survey) => (
        <div key={survey.id} className="survey-item" data-div={survey.id}>
          <div className="survey-info">
            <p className="survey-date" data-container="date">
              📅 {survey.date || 'Дата не указана'}
            </p>
            <p className="survey-name">
              <strong>👤 Пациент:</strong> {survey.nameSurname || "Не указано"}
            </p>
            <p className="survey-age">
              <strong>🎂 Возраст:</strong> {survey.age || "Не указано"}
            </p>
            {survey.temperature && (
              <p className="survey-temperature">
                <strong>🌡️ Температура:</strong> {survey.temperature}
              </p>
            )}
            {survey.title && survey.title.length > 0 && (
              <p className="survey-diagnosis">
                <strong>🏥 Диагнозы:</strong> 
                {Array.isArray(survey.title) ? survey.title.join(' ') : survey.title}
              </p>
            )}
          </div>
          <div className="survey-actions">
            <button 
              className="buttonFromTemplate view-button" 
              type="button" 
              data-container="lookButton"
              data-id={survey.id}
              onClick={() => onView(survey)}
            >
              <i className="fas fa-eye"></i> Посмотреть
            </button>
            <button 
              className="buttonFromTemplate delete-button" 
              type="button" 
              data-container="deleteButton"
              data-id={survey.id}
              onClick={() => survey.id && onDelete(survey.id)}
            >
              <i className="fas fa-trash-alt"></i> Удалить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SurveyList;