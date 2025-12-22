import React from 'react';
import { Survey } from '../../types/account.types';
import './SurveyList.css';

interface SurveyListProps {
  surveys: Survey[];
  onView: (survey: Survey) => void;
  onDelete: (id: number) => void;
}

const SurveyList: React.FC<SurveyListProps> = ({ surveys, onView, onDelete }) => {  
  if (surveys.length === 0) {
    return (
      <div className="survey-list-account-empty-message">
        <i className="fas fa-clipboard-list fa-2x"></i>
        <h3>Нет сохраненных опросов</h3>
        <p>Создайте первый опрос, чтобы он появился здесь</p>
      </div>
    );
  }

  // Обработчик клика по карточке
  const handleCardClick = (survey: Survey, e: React.MouseEvent) => {
    // Проверяем, не кликнули ли на кнопку удаления
    const target = e.target as HTMLElement;
    if (target.closest('.survey-list-account-delete-button')) {
      return; // Не обрабатываем клик по кнопке удаления
    }
    onView(survey);
  };

  // Обработчик клика по кнопке удаления
  const handleDeleteClick = (id: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation(); // Останавливаем всплытие
    if (id) onDelete(id);
  };

  // Форматирование даты
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Дата не указана';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="survey-list-account-grid">
      {surveys.map((survey) => (
        <div 
          key={survey.id} 
          className="survey-list-account-card" 
          onClick={(e) => handleCardClick(survey, e)}
        >
          {/* Заголовок карточки с датой */}
          <div className="survey-list-account-card-header">
            <div className="survey-list-account-date-badge">
              <i className="far fa-calendar"></i>
              <span>{formatDate(survey.date)}</span>
            </div>
            <div className="survey-list-account-id">
              #{survey.id}
            </div>
          </div>

          {/* Основная информация */}
          <div className="survey-list-account-content">
            <div className="survey-list-account-patient-info">
              <div className="survey-list-account-patient-name">
                <i className="fas fa-user"></i>
                <span className="survey-list-account-name-text" title={survey.nameSurname || "Не указано"}>
                  {survey.nameSurname || "Пациент не указан"}
                </span>
              </div>
              
              {survey.age && (
                <div className="survey-list-account-patient-age">
                  <i className="fas fa-birthday-cake"></i>
                  <span>{survey.age} лет</span>
                </div>
              )}
            </div>

            {/* Диагнозы */}
            {survey.title && survey.title.length > 0 && (
              <div className="survey-list-account-diagnoses">
                <div className="survey-list-account-diagnoses-label">
                  <i className="fas fa-stethoscope"></i>
                  <span>Диагнозы:</span>
                </div>
                <div className="survey-list-account-diagnoses-list">
                  {Array.isArray(survey.title) 
                    ? survey.title.slice(0, 2).map((diag, idx) => (
                        <span key={idx} className="survey-list-account-diagnosis-tag">
                          {diag}
                        </span>
                      ))
                    : <span className="survey-list-account-diagnosis-tag">
                        {survey.title}
                      </span>
                  }
                  {Array.isArray(survey.title) && survey.title.length > 2 && (
                    <span className="survey-list-account-diagnosis-more">
                      +{survey.title.length - 2} еще
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Температура */}
            {survey.temperature && (
              <div className="survey-list-account-temperature-info">
                <i className="fas fa-thermometer-half"></i>
                <span>Температура: {survey.temperature}</span>
              </div>
            )}

            {/* Дополнительная информация */}
            <div className="survey-list-account-meta">
              {survey.created_at && (
                <div className="survey-list-account-created">
                  <i className="far fa-clock"></i>
                  <span>Создан: {formatDate(survey.created_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка удаления */}
          <div className="survey-list-account-card-footer">
            <button 
              className="buttonFromTemplate survey-list-account-delete-button" 
              type="button" 
              onClick={(e) => handleDeleteClick(survey.id, e)}
              title="Удалить опрос"
            >
              <i className="fas fa-trash-alt"></i> Удалить
            </button>
          </div>

          {/* Overlay при наведении */}
          <div className="survey-list-account-overlay">
            <div className="survey-list-account-view-action">
              <i className="fas fa-eye"></i>
              <span>Посмотреть опрос</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

SurveyList.displayName = 'SurveyList';

export default SurveyList;