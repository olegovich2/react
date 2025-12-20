// SurveysContainer.paginated.tsx (исправленная версия)
import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- Добавляем
import { useAccountContext } from '../../context/AccountContext';
import { surveysApi } from '../../../../api/surveys.api';
import SurveyList from '../SurveyList/SurveyList';
import Pagination from '../Pagination/Pagination';
import { Survey as SurveyType } from '../../types/account.types';
import './SurveyContainer.css';

const SurveysContainerPaginated: React.FC = React.memo(() => {
  const { 
    setSurveys, 
    setIsLoading,
    surveysPagination,
    setSurveysPagination,
    updateSurveysPage
  } = useAccountContext();

  const navigate = useNavigate(); // <-- Добавляем навигацию

  const [localSurveys, setLocalSurveys] = useState<SurveyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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
      
      const headerHeight = 80;
      const elementPosition = surveysContainerRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, []);

  // Загрузка опросов с пагинацией
  const loadPaginatedSurveys = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    setCurrentPage(page);
    
    try {
      console.log(`📥 Загрузка опросов через surveysApi, страница ${page}...`);
      
      const response = await surveysApi.getPaginatedSurveys({
        page,
        limit: itemsPerPage
      });
      
      if (response.success && response.data) {
        console.log('📥 Данные от surveysApi с пагинацией:', {
          surveysCount: response.data.surveys.length,
          pagination: response.data.pagination
        });
        
        const processedSurveys: SurveyType[] = response.data.surveys;
        
        console.log(`✅ Загружено опросов: ${processedSurveys.length}`);
        
        setLocalSurveys(processedSurveys);
        
        // Обновляем пагинацию в контексте
        if (response.data.pagination) {
          setSurveysPagination({
            currentPage: page,
            totalPages: response.data.pagination.totalPages,
            totalItems: response.data.pagination.totalItems,
            itemsPerPage: itemsPerPage
          });
        }
        
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
  }, [setSurveys, setIsLoading, setSurveysPagination, itemsPerPage, scrollToSurveys]);

  // Обработчик смены страницы
  const handlePageChange = useCallback((page: number) => {
    console.log(`🔄 Переход на страницу ${page} через surveysApi`);
    loadPaginatedSurveys(page);
    // Обновляем страницу в контексте отдельно
    updateSurveysPage(page);
  }, [loadPaginatedSurveys, updateSurveysPage]);

  // Удаление опроса
  const handleDeleteSurvey = useCallback(async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот опрос?')) {
      return;
    }

    try {
      // Используем surveysApi для удаления
      const result = await surveysApi.deleteSurvey(id);
      
      if (result.success) {
        console.log(`✅ Опрос ${id} удален, страница перезагружена`);
        // Перезагружаем текущую страницу после удаления
        await loadPaginatedSurveys(currentPage);
      } else {
        console.error('Ошибка удаления опроса через surveysApi:', result.message);
        setError(result.message || 'Ошибка удаления опроса');
      }
    } catch (deleteError: any) {
      console.error('Ошибка удаления опроса:', deleteError);
      setError(deleteError.message || 'Ошибка удаления опроса');
    }
  }, [currentPage, loadPaginatedSurveys]);

  // Просмотр опроса - ПЕРЕХОД НА СТРАНИЦУ
  const handleViewSurvey = useCallback((survey: SurveyType) => {
    console.log('📄 Переход к просмотру опроса:', {
      id: survey.id,
      date: survey.date,
      name: survey.nameSurname
    });
    navigate(`/account/survey/${survey.id}`);
  }, [navigate]);

  // Первоначальная загрузка - используем сохраненную страницу из контекста
  useEffect(() => {
    const initialPage = surveysPagination.currentPage;
    console.log(`🔄 Начальная загрузка опросов через surveysApi. Страница из контекста: ${initialPage}...`);
    setCurrentPage(initialPage);
    loadPaginatedSurveys(initialPage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Мемоизация компонента пагинации
  const paginationComponent = useMemo(() => {
    if (!surveysPagination || surveysPagination.totalPages <= 1) return null;
    
    return (
      <Pagination
        currentPage={surveysPagination.currentPage}
        totalPages={surveysPagination.totalPages}
        totalItems={surveysPagination.totalItems}
        onPageChange={handlePageChange}
        scrollToElement={scrollToSurveys}
        autoScroll={true}
      />
    );
  }, [surveysPagination, handlePageChange, scrollToSurveys]);

  // Отображение статуса загрузки
  const renderLoading = useMemo(() => {
    if (!loading) return null;
    
    return (
      <div className="loading-message">
        <i className="fas fa-spinner fa-spin"></i>
        <p>Загрузка опросов...</p>
      </div>
    );
  }, [loading]);

  // Отображение ошибки
  const renderError = useMemo(() => {
    if (!error) return null;
    
    return (
      <div className="error-message">
        <i className="fas fa-exclamation-triangle"></i>
        <p>{error}</p>
        <button 
          onClick={() => loadPaginatedSurveys(currentPage)}
          className="retry-button"
        >
          <i className="fas fa-redo"></i> Попробовать снова
        </button>
      </div>
    );
  }, [error, currentPage, loadPaginatedSurveys]);

  // Отображение сообщения об отсутствии опросов
  const renderEmptyMessage = useMemo(() => {
    if (loading || error || localSurveys.length > 0) return null;
    
    return (
      <div className="empty-message">
        <i className="fas fa-clipboard-list"></i>
        <p>У вас пока нет опросов</p>
        <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
          Создайте первый опрос на главной странице
        </p>
      </div>
    );
  }, [loading, error, localSurveys.length]);

  // Отображение заголовка с пагинацией
  const renderSurveysHeader = useMemo(() => {
    if (localSurveys.length === 0) return null;
    
    return (
      <div className="surveys-header">
        <p>Найдено опросов: <strong>{surveysPagination.totalItems || 0}</strong></p>
        {surveysPagination && (
          <p className="page-info">
            Страница <strong>{currentPage}</strong> из <strong>{surveysPagination.totalPages}</strong>
          </p>
        )}
      </div>
    );
  }, [localSurveys.length, surveysPagination, currentPage]);

  // Отображение списка опросов
  const renderSurveyList = useMemo(() => {
    if (localSurveys.length === 0) return null;
    
    return (
      <SurveyList
        surveys={localSurveys}
        onView={handleViewSurvey} // <-- Используем новую функцию
        onDelete={handleDeleteSurvey}
      />
    );
  }, [localSurveys, handleViewSurvey, handleDeleteSurvey]);

  return (
    <div className="area_inspection_list" ref={surveysContainerRef}>
      <h2>Все осмотры</h2>
      
      {renderLoading}
      {renderError}
      {renderEmptyMessage}
      
      {localSurveys.length > 0 && (
        <>
          {renderSurveysHeader}
          {renderSurveyList}
          {paginationComponent}
        </>
      )}
    </div>
  );
});

SurveysContainerPaginated.displayName = 'SurveysContainerPaginated';

export default SurveysContainerPaginated;