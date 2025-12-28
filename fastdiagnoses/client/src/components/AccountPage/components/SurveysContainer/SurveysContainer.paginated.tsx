import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const navigate = useNavigate();

  const [localSurveys, setLocalSurveys] = useState<SurveyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsPerPage = 5;

  // Ref для отслеживания первого рендера
  const isInitialMount = useRef(true);

  // Загрузка опросов с пагинацией
  const loadPaginatedSurveys = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    
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
  }, [setSurveys, setIsLoading, setSurveysPagination, itemsPerPage]);

  // Обработчик смены страницы
  const handlePageChange = useCallback((page: number) => {
    console.log(`🔄 Переход на страницу ${page} через surveysApi`);
    loadPaginatedSurveys(page);
    // Обновляем страницу в контекст (сохранится в localStorage)
    updateSurveysPage(page);
  }, [loadPaginatedSurveys, updateSurveysPage]);

  // Обновляем функцию handleDeleteSurvey
const handleDeleteSurvey = useCallback(async (id: number) => {
  if (!window.confirm('Вы уверены, что хотите удалить этот опрос?')) {
    return;
  }

  setIsLoading(true);
  try {
    // Используем surveysApi для удаления
    const result = await surveysApi.deleteSurvey(id);
    
    if (result.success) {
      console.log(`✅ Опрос ${id} удален`);
      
      // Получаем текущее состояние пагинации
      const currentPage = surveysPagination.currentPage;
      const totalItemsAfterDeletion = surveysPagination.totalItems - 1;
      const itemsPerPage = surveysPagination.itemsPerPage;
      
      // Вычисляем новое количество страниц
      const newTotalPages = Math.max(1, Math.ceil(totalItemsAfterDeletion / itemsPerPage));
      
      // Если текущая страница больше новой последней страницы или на текущей странице не осталось элементов
      const isLastItemOnPage = localSurveys.length === 1;
      const shouldGoToPreviousPage = currentPage > newTotalPages || isLastItemOnPage;
      
      let pageToLoad = currentPage;
      
      if (shouldGoToPreviousPage) {
        // Переходим на предыдущую страницу (но не меньше 1)
        pageToLoad = Math.max(1, newTotalPages);
        console.log(`🔄 Переход на страницу ${pageToLoad} после удаления последнего элемента`);
      }
      
      // Обновляем пагинацию в контексте
      setSurveysPagination(prev => ({
        ...prev,
        totalItems: totalItemsAfterDeletion,
        totalPages: newTotalPages,
        currentPage: pageToLoad
      }));
      
      // Перезагружаем нужную страницу
      await loadPaginatedSurveys(pageToLoad);
      
    } else {
      console.error('Ошибка удаления опроса через surveysApi:', result.message);
      setError(result.message || 'Ошибка удаления опроса');
    }
  } catch (deleteError: any) {
    console.error('Ошибка удаления опроса:', deleteError);
    setError(deleteError.message || 'Ошибка удаления опроса');
  } finally {
    setIsLoading(false);
  }
}, [
  setIsLoading,
  loadPaginatedSurveys,
  surveysPagination.currentPage,
  surveysPagination.totalItems,
  surveysPagination.itemsPerPage,
  localSurveys.length,
  setSurveysPagination
]);

  // Просмотр опроса - ПЕРЕХОД НА СТРАНИЦУ
  const handleViewSurvey = useCallback((survey: SurveyType) => {
    console.log('📄 Переход к просмотру опроса:', {
      id: survey.id,
      date: survey.date,
      name: survey.nameSurname,
      currentPage: surveysPagination.currentPage // Сохраняем текущую страницу
    });
    navigate(`/account/survey/${survey.id}`);
  }, [navigate, surveysPagination.currentPage]);

  // Первоначальная загрузка - используем сохраненную страницу из localStorage через контекст
  useEffect(() => {
    console.log(`🔄 Начальная загрузка опросов через surveysApi. Страница из localStorage: ${surveysPagination.currentPage}...`);
    loadPaginatedSurveys(surveysPagination.currentPage);
    
    // Отмечаем, что первый рендер завершен
    isInitialMount.current = false;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Мемоизация компонента пагинации - передаем функцию для прокрутки к опросам
  const paginationComponent = useMemo(() => {
    if (!surveysPagination || surveysPagination.totalPages <= 1) return null;
    
    return (
      <Pagination
        currentPage={surveysPagination.currentPage}
        totalPages={surveysPagination.totalPages}
        totalItems={surveysPagination.totalItems}
        onPageChange={handlePageChange}
        autoScroll={true}
        targetElementId="surveys-container"
      />
    );
  }, [surveysPagination, handlePageChange]);

  // Отображение статуса загрузки
  const renderLoading = useMemo(() => {
    if (!loading) return null;
    
    return (
      <div className="surveys-container-loading-message">
        <i className="fas fa-spinner fa-spin"></i>
        <p>Загрузка опросов...</p>
      </div>
    );
  }, [loading]);

  // Отображение ошибки
  const renderError = useMemo(() => {
    if (!error) return null;
    
    return (
      <div className="surveys-container-error-message">
        <i className="fas fa-exclamation-triangle"></i>
        <p>{error}</p>
        <button 
          onClick={() => loadPaginatedSurveys(surveysPagination.currentPage)}
          className="surveys-container-retry-button"
        >
          <i className="fas fa-redo"></i> Попробовать снова
        </button>
      </div>
    );
  }, [error, surveysPagination.currentPage, loadPaginatedSurveys]);

  // Отображение сообщения об отсутствии опросов
  const renderEmptyMessage = useMemo(() => {
    if (loading || error || localSurveys.length > 0) return null;
    
    return (
      <div className="surveys-container-empty-message">
        <i className="fas fa-clipboard-list"></i>
        <p>У вас пока нет опросов</p>
        <p className="surveys-container-empty-subtext">
          Создайте первый опрос на главной странице
        </p>
      </div>
    );
  }, [loading, error, localSurveys.length]);

  // Отображение заголовка с пагинацией
  const renderSurveysHeader = useMemo(() => {
    if (localSurveys.length === 0) return null;
    
    return (
      <div className="surveys-container-header">
        <p>Найдено опросов: <strong>{surveysPagination.totalItems || 0}</strong></p>
        {surveysPagination && (
          <p className="surveys-container-page-info">
            Страница <strong>{surveysPagination.currentPage}</strong> из <strong>{surveysPagination.totalPages}</strong>
          </p>
        )}
      </div>
    );
  }, [localSurveys.length, surveysPagination]);

  // Отображение списка опросов
  const renderSurveyList = useMemo(() => {
    if (localSurveys.length === 0) return null;
    
    return (
      <SurveyList
        surveys={localSurveys}
        onView={handleViewSurvey}
        onDelete={handleDeleteSurvey}
      />
    );
  }, [localSurveys, handleViewSurvey, handleDeleteSurvey]);

  return (
    <div id="surveys-container" className="surveys-container">
      <h2>Все осмотры</h2>
      
      {renderLoading}
      {renderError}
      {renderEmptyMessage}
      
      {localSurveys.length > 0 && (
        <>
          {/* ПАГИНАЦИЯ СВЕРХУ */}
          {paginationComponent}
          
          {renderSurveysHeader}
          {renderSurveyList}
          
          {/* ПАГИНАЦИЯ СНИЗУ */}
          {paginationComponent}
        </>
      )}
    </div>
  );
});

SurveysContainerPaginated.displayName = 'SurveysContainerPaginated';

export default SurveysContainerPaginated;