import React from 'react';
import { Survey } from '../../types/api.types';

interface SurveyListProps {
  surveys: Survey[];
  onView: (survey: Survey) => void;
  onDelete: (id: string) => void;
}

const SurveyList: React.FC<SurveyListProps> = ({ surveys, onView, onDelete }) => {
  if (surveys.length === 0) {
    return <div>Нет сохраненных опросов</div>;
  }

  return (
    <div data-container="allSurveyFromDB">
      {surveys.map((survey) => (
        <div key={survey.id} className="oneSurvey" data-div={survey.id}>
          <p data-container="date">{survey.date}</p>
          <button 
            className="buttonFromTemplate" 
            type="button" 
            data-container="lookButton"
            data-id={survey.id}
            onClick={() => onView(survey)}
          >
            Посмотреть
          </button>
          <button 
            className="buttonFromTemplate" 
            type="button" 
            data-container="deleteButton"
            data-id={survey.id}
            onClick={() => survey.id && onDelete(survey.id)}
          >
            Удалить
          </button>
        </div>
      ))}
    </div>
  );
};

export default SurveyList;