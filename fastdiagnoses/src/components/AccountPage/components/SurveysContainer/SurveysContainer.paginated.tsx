// AccountPage/components/SurveysContainer/SurveysContainer.paginated.tsx
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useAccountContext } from '../../context/AccountContext';
import { fetchClient } from '../../../../api/fetchClient';
import SurveyList from '../SurveyList/SurveyList';
import SurveyModal from './SurveyModal';
import Pagination from '../Pagination/Pagination';
import { Survey as SurveyType } from '../../types/account.types';

// Типы для пагинации
interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Тип для сырых данных из API
interface RawSurveyData {
  id: number;
  date?: string;
  survey?: string | object;
}

const SurveysContainerPaginated: React.FC = React.memo(() => {
  const { 
    setSurveys, 
    selectedSurvey, 
    setSelectedSurvey, 
    showSurveyModal, 
    setShowSurveyModal,
    setIsLoading 
  } = useAccountContext();

  const [surveys, setLocalSurveys] = useState<SurveyType[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 5;

  // Ref для прокрутки
  const surveysContainerRef = useRef<HTMLDivElement>(null);

  // Функция прокрутки к этому блоку
  const scrollToSurveys = useCallback(() => {
    if (surveysContainerRef.current) {
      surveysContainerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      
      // Дополнительная прокрутка с учетом фиксированного хедера
      const headerHeight = 80;
      const elementPosition = surveysContainerRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    } else {
      // Fallback
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, []);

  // Загрузка опросов с пагинацией
  const loadPaginatedSurveys = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`📥 Загрузка опросов, страница ${page}...`);
      
      const response = await fetchClient.getPaginatedSurveys({
        page,
        limit: itemsPerPage
      });
      
      if (response.success && response.data) {
        console.log('📥 Данные от API с пагинацией:', response.data);
        
        // Преобразуем данные из JSON с правильной типизацией
        const processedSurveys: SurveyType[] = response.data.surveys.map((row: RawSurveyData) => {
          try {
            let parsedSurvey;
            if (typeof row.survey === 'string') {
              console.log('📄 Парсим JSON строку');
              parsedSurvey = JSON.parse(row.survey);
              console.log('✅ Распарсено:', parsedSurvey);
            } else if (row.survey && typeof row.survey === 'object') {
              console.log('📄 Survey уже объект:', row.survey);
              parsedSurvey = row.survey;
            } else {
              console.log('⚠️ Survey отсутствует или null');
              parsedSurvey = {};
            }
            
            return {
              id: row.id,
              date: row.date || parsedSurvey.date || 'Не указано',
              nameSurname: parsedSurvey.nameSurname || parsedSurvey.name || parsedSurvey.fio || 'Не указано',
              age: parsedSurvey.age || '',
              temperature: parsedSurvey.temperature || '',
              anamnesis: parsedSurvey.anamnesis || parsedSurvey.symptoms || parsedSurvey.description || '',
              title: parsedSurvey.title || parsedSurvey.diagnosis || [],
              diagnostic: parsedSurvey.diagnostic || parsedSurvey.examinations || [],
              treatment: parsedSurvey.treatment || [],
              otherGuidelines: parsedSurvey.otherGuidelines || []
            };
            
          } catch (parseError) {
            console.error('❌ Ошибка парсинга опроса ID:', row.id, parseError);
            return {
              id: row.id,
              date: row.date || 'Не указано',
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
        
        console.log(`✅ Загружено опросов: ${processedSurveys.length}`);
        
        setLocalSurveys(processedSurveys);
        setPagination(response.data.pagination);
        setCurrentPage(page);
        
        // Обновляем контекст для обратной совместимости
        setSurveys(processedSurveys);
        
        // Прокрутка к началу после загрузки (если не первая страница)
        if (page !== 1) {
          setTimeout(() => {
            scrollToSurveys();
          }, 100);
        }
        
      } else {
        setError(response.message || 'Ошибка загрузки опросов');
        console.error('❌ Ошибка загрузки опросов:', response.message);
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка загрузки опросов');
      console.error('❌ Ошибка загрузки опросов:', error);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }, [setSurveys, setIsLoading, scrollToSurveys]);

  // Удаление опроса
  const handleDeleteSurvey = useCallback(async (id: number) => {
    try {
      const result = await fetchClient.deleteSurveyOrImage(id);
      
      if (result.success) {
        // Перезагружаем текущую страницу после удаления
        await loadPaginatedSurveys(currentPage);
        console.log(`✅ Опрос ${id} удален, страница перезагружена`);
      } else {
        console.error('Ошибка удаления опроса:', result.message);
      }
    } catch (deleteError) {
      console.error('Ошибка удаления опроса:', deleteError);
    }
  }, [currentPage, loadPaginatedSurveys]);

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

  // Обработчик смены страницы
  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && pagination && page <= pagination.totalPages) {
      loadPaginatedSurveys(page);
    }
  }, [pagination, loadPaginatedSurveys]);

  // Первоначальная загрузка
  useEffect(() => {
    console.log('🔄 Начальная загрузка опросов с пагинацией...');
    loadPaginatedSurveys(1);
  }, [loadPaginatedSurveys]);

  // Отладочный вывод текущего состояния
  useEffect(() => {
    console.log('📊 Текущие опросы в состоянии:', surveys);
  }, [surveys]);

  return (
    <div className="area_inspection_list" ref={surveysContainerRef}>
      <h2>Все осмотры</h2>
      
      {loading ? (
        <div className="loading-message">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Загрузка опросов...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error}</p>
          <button 
            onClick={() => loadPaginatedSurveys(currentPage)}
            className="retry-button"
          >
            Попробовать снова
          </button>
        </div>
      ) : surveys.length === 0 ? (
        <div className="empty-message">
          <i className="fas fa-clipboard-list"></i>
          <p>У вас пока нет опросов</p>
        </div>
      ) : (
        <>
          <div className="surveys-header">
            <p>Найдено опросов: <strong>{pagination?.totalItems || 0}</strong></p>
            {pagination && (
              <p className="page-info">
                Страница {pagination.currentPage} из {pagination.totalPages}
              </p>
            )}
          </div>
          
          <SurveyList
            surveys={surveys}
            onView={handleViewSurvey}
            onDelete={handleDeleteSurvey}
          />
          
          {/* Компонент пагинации с функцией прокрутки */}
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              totalItems={pagination.totalItems}
              scrollToElement={scrollToSurveys}
              autoScroll={true}
            />
          )}
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

SurveysContainerPaginated.displayName = 'SurveysContainerPaginated';

export default SurveysContainerPaginated;