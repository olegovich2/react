// src/components/AccountPage/components/SurveysContainer/SurveysContainer.tsx
import React, { useEffect, useCallback } from 'react';
import { useAccountContext } from '../../context/AccountContext';
import { getUserSurveys, deleteSurvey } from '../../../../api/surveys.api';
import SurveyList from '../SurveyList/SurveyList';
import SurveyModal from './SurveyModal';
import { Survey as SurveyType } from '../../types/account.types'; // Импортируем тип

// Тип для сырых данных из API
interface RawSurveyData {
  id: number;
  date?: string;
  survey?: string | object; // Может быть строкой или объектом
}

const SurveysContainer: React.FC = React.memo(() => {
  const { 
    surveys, 
    setSurveys, 
    selectedSurvey, 
    setSelectedSurvey, 
    showSurveyModal, 
    setShowSurveyModal,
    setIsLoading 
  } = useAccountContext();

  // Загрузка опросов
  const loadSurveys = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getUserSurveys(); 
      if (result.success && result.data) {
        console.log('📥 Сырые данные от API:', result.data);
        
        // Преобразуем данные из JSON с правильной типизацией
        const processedSurveys: SurveyType[] = result.data.map((rawSurvey: RawSurveyData) => {
          try {
            console.log('🔍 Обработка опроса ID:', rawSurvey.id, 'Данные:', rawSurvey);
            
            // Если survey - строка, парсим ее
            if (typeof rawSurvey.survey === 'string') {
              console.log('📄 Парсим JSON строку');
              const parsed = JSON.parse(rawSurvey.survey);
              console.log('✅ Распарсено:', parsed);
              return {
                id: rawSurvey.id,
                date: parsed.date || rawSurvey.date || 'Не указано',
                nameSurname: parsed.nameSurname || parsed.name || parsed.fio || 'Не указано',
                age: parsed.age || '',
                temperature: parsed.temperature || '',
                anamnesis: parsed.anamnesis || parsed.symptoms || parsed.description || '',
                title: parsed.title || parsed.diagnosis || [],
                diagnostic: parsed.diagnostic || parsed.examinations || [],
                treatment: parsed.treatment || [],
                otherGuidelines: parsed.otherGuidelines || []
              };
            } 
            // Если survey - объект
            else if (rawSurvey.survey && typeof rawSurvey.survey === 'object') {
              console.log('📄 Survey уже объект:', rawSurvey.survey);
              const surveyObj = rawSurvey.survey as any;
              return {
                id: rawSurvey.id,
                date: surveyObj.date || rawSurvey.date || 'Не указано',
                nameSurname: surveyObj.nameSurname || surveyObj.name || surveyObj.fio || 'Не указано',
                age: surveyObj.age || '',
                temperature: surveyObj.temperature || '',
                anamnesis: surveyObj.anamnesis || surveyObj.symptoms || surveyObj.description || '',
                title: surveyObj.title || surveyObj.diagnosis || [],
                diagnostic: surveyObj.diagnostic || surveyObj.examinations || [],
                treatment: surveyObj.treatment || [],
                otherGuidelines: surveyObj.otherGuidelines || []
              };
            }
            // Если survey отсутствует
            else {
              console.log('⚠️ Survey отсутствует или null');
              return {
                id: rawSurvey.id,
                date: rawSurvey.date || 'Не указано',
                nameSurname: 'Не указано',
                age: '',
                temperature: '',
                anamnesis: '',
                title: [],
                diagnostic: [],
                treatment: [],
                otherGuidelines: []
              };
            }
          } catch (error) {
            console.error('❌ Ошибка парсинга опроса ID:', rawSurvey.id, error);
            return {
              id: rawSurvey.id,
              date: rawSurvey.date || 'Не указано',
              nameSurname: 'Ошибка загрузки данных',
              age: '',
              temperature: '',
              anamnesis: '',
              title: [],
              diagnostic: [],
              treatment: [],
              otherGuidelines: []
            };
          }
        });
        
        console.log('✅ Обработанные опросы:', processedSurveys);
        setSurveys(processedSurveys);
      } else {
        console.error('❌ Ошибка загрузки опросов:', result.message);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки опросов:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setSurveys, setIsLoading]);

  // Удаление опроса
  const handleDeleteSurvey = useCallback(async (id: number) => {
    try {
      const result = await deleteSurvey(id); 
      if (result.success) {
        // Обновляем локальный стейт без перезагрузки всей страницы
        setSurveys(prev => prev.filter(survey => survey.id !== id));
        console.log(`✅ Опрос ${id} удален`);
      } else {
        console.error('Ошибка удаления опроса:', result.message);
      }
    } catch (error) {
      console.error('Ошибка удаления опроса:', error);
    }
  }, [setSurveys]);

  // Просмотр опроса
  const handleViewSurvey = useCallback((survey: SurveyType) => {
    console.log('📄 Просмотр опроса:', survey);
    setSelectedSurvey(survey);
    setShowSurveyModal(true);
  }, [setSelectedSurvey, setShowSurveyModal]);

  // Закрытие модального окна
  const handleCloseModal = useCallback(() => {
    setShowSurveyModal(false);
    setSelectedSurvey(null);
  }, [setShowSurveyModal, setSelectedSurvey]);

  // Первоначальная загрузка
  useEffect(() => {
    console.log('🔄 Загрузка опросов...');
    loadSurveys();
  }, [loadSurveys]);

  // Отладочный вывод текущего состояния
  useEffect(() => {
    console.log('📊 Текущие опросы в состоянии:', surveys);
  }, [surveys]);

  return (
    <div className="area_inspection_list">
      <h2>Все осмотры</h2>
      
      {surveys.length === 0 ? (
        <div className="empty-message">
          <i className="fas fa-clipboard-list"></i>
          <p>У вас пока нет опросов</p>
        </div>
      ) : (
        <>
          <div className="surveys-count">
            <p>Найдено опросов: <strong>{surveys.length}</strong></p>
          </div>
          <SurveyList
            surveys={surveys}
            onView={handleViewSurvey}
            onDelete={handleDeleteSurvey}
          />
        </>
      )}

      {/* Модальное окно с опросом */}
      {showSurveyModal && selectedSurvey && (
        <SurveyModal
          survey={selectedSurvey}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
});

SurveysContainer.displayName = 'SurveysContainer';

export default SurveysContainer;