import { BaseApiService, APIResponse, PaginationInfo } from './BaseApiService';
import { fetchClient } from './fetchClient';
import { 
  Survey,
  SingleSurveyResponseData,
  normalizeSurvey as normalizeSurveyFromTypes
} from '../components/AccountPage/types/account.types';

/**
 * API сервис для работы с опросами
 */
class SurveysApi extends BaseApiService<Survey> {
  protected endpoint = '/surveys/paginated';
  protected entityName = 'опросов';

  // ==================== РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ ====================

  protected extractItems(data: any): any[] {
    // Сервер возвращает { surveys: [...], pagination: {...} }
    return data.surveys || [];
  }

  protected processItems(items: any[]): Survey[] {
    return items.map((item: any) => {
      // Если сервер возвращает RawSurveyFromServer (с полями id, date, survey)
      if (item.id !== undefined && item.date !== undefined && item.survey !== undefined) {
        const surveyWithId = {
          ...item.survey,
          id: item.id,
          created_at: item.date,
        };
        
        if (!surveyWithId.date) {
          surveyWithId.date = item.date;
        }
        
        return this.normalizeSurveyData(surveyWithId);
      }
      
      // Если сервер уже возвращает нормализованный Survey
      return this.normalizeSurveyData(item);
    });
  }

  protected extractSingleItem(data: any): any {
    return data.survey || data;
  }

  protected processSingleItem(item: any): Survey {
    return this.normalizeSurveyData(item);
  }

  // ==================== ПУБЛИЧНЫЕ МЕТОДЫ ДЛЯ ОПРОСОВ ====================

  /**
   * Сохранение опроса в БД (публичный метод)
   */
  async saveSurveyToDB(surveyData: Survey | string): Promise<APIResponse<{ message: string }>> {
    try {
      console.log(`💾 Сохранение опроса...`);
      
      let surveyObj: Survey;
      if (typeof surveyData === 'string') {
        surveyObj = JSON.parse(surveyData);
      } else {
        surveyObj = surveyData;
      }
      
      const response = await fetchClient.post<{ message: string }>(
        '/surveys/save', 
        { survey: surveyObj }
      );
      
      return {
        success: response.success,
        message: response.message,
        status: response.status,
        field: response.field
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка сохранения опроса:', error);
      return {
        success: false,
        message: error.message || 'Ошибка сохранения опроса'
      };
    }
  }

  /**
   * Получение рекомендаций по диагнозам (публичный метод)
   */
  async getDiagnosisRecommendations(titles: string[]): Promise<APIResponse<{ 
    title: string[]; 
    diagnostic: string[]; 
    treatment: string[] 
  }>> {
    try {
      console.log('🔍 Поиск рекомендаций для диагнозов:', titles);
      
      const response = await fetchClient.post<{
        titles: string[];
        diagnostic: string[];
        treatment: string[];
      }>('/diagnoses/search', { titles });
      
      if (response.success && response.data) {
        return {
          success: true,
          data: {
            title: response.data.titles || [],
            diagnostic: response.data.diagnostic || [],
            treatment: response.data.treatment || []
          },
          status: response.status
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения рекомендаций',
        status: response.status
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения рекомендаций:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения рекомендаций',
        status: 0
      };
    }
  }

  /**
   * Получение конкретного опроса по ID (публичный метод)
   */
  async getSurveyById(id: number): Promise<APIResponse<Survey>> {
    try {
      console.log(`🔍 Получение опроса с ID: ${id}`);
      
      const response = await fetchClient.get<SingleSurveyResponseData>(`/surveys/${id}`);
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data.survey,
          status: response.status
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения опроса',
        status: response.status
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения опроса:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения опроса',
        status: 0
      };
    }
  }

  /**
   * Получение опросов с пагинацией (публичный метод для обратной совместимости)
   * Возвращает старую структуру { surveys: [...], pagination: {...} }
   */
  async getPaginatedSurveys(params?: {
    page?: number;
    limit?: number;
  }): Promise<APIResponse<{
    surveys: Survey[];
    pagination: PaginationInfo;
  }>> {
    try {
      console.log(`📥 Получение опросов с пагинацией через getPaginated...`);
      
      // Используем базовый метод getPaginated
      const response = await this.getPaginated(params);
      
      if (response.success && response.data) {
        // Преобразуем items → surveys для обратной совместимости
        return {
          success: true,
          data: {
            surveys: response.data.items, // items → surveys
            pagination: response.data.pagination
          },
          status: response.status,
          responseTime: response.responseTime
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения опросов',
        status: response.status
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения опросов:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения опросов',
        status: 0
      };
    }
  }

  /**
   * Удаление опроса (публичный метод)
   */
  async deleteSurvey(id: number): Promise<APIResponse<{ message: string }>> {
    try {
      console.log(`🗑️ Удаление опроса ${id}...`);
      
      const response = await fetchClient.delete<{ message: string }>(`/data/${id}`);
      
      return {
        success: response.success,
        message: response.message || (response.success ? 'Опрос удален' : 'Ошибка удаления'),
        status: response.status,
        field: response.field
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка удаления опроса:', error);
      return {
        success: false,
        message: error.message || 'Ошибка удаления опроса',
        status: 0
      };
    }
  }

  // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

  /**
   * Гарантирует, что значение является массивом строк (публичный метод)
   */
  ensureStringArray(value: any): string[] {
    if (!value) return [];
    
    if (Array.isArray(value)) {
      return value
        .map((item: any) => String(item).trim())
        .filter((item: string) => item.length > 0);
    }
    
    if (typeof value === 'string') {
      if (value.includes(',')) {
        return value
          .split(',')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0);
      }
      return [value.trim()].filter((item: string) => item.length > 0);
    }
    
    return [String(value)].filter((item: string) => item.length > 0);
  }

  /**
   * Нормализует Survey объект (приватный метод)
   */
  private normalizeSurveyData(survey: any): Survey {
    // Используем готовую функцию normalizeSurvey из account.types.ts если она есть
    if (typeof normalizeSurveyFromTypes === 'function') {
      const normalized = normalizeSurveyFromTypes(survey);
      
      // Добавляем дополнительную обработку если нужно
      return {
        ...normalized,
        // Гарантируем, что массивы всегда являются массивами строк
        title: this.ensureStringArray(normalized.title),
        diagnostic: this.ensureStringArray(normalized.diagnostic),
        treatment: this.ensureStringArray(normalized.treatment),
        otherGuidelines: this.ensureStringArray(normalized.otherGuidelines),
        // Сохраняем оригинальные данные если они есть
        survey: survey.survey || normalized.survey,
        created_at: survey.created_at || normalized.created_at
      };
    }
    
    // Fallback если функция normalizeSurvey не экспортирована
    return {
      id: survey.id || 0,
      date: survey.date || new Date().toLocaleString('ru-RU'),
      nameSurname: survey.nameSurname || survey.name || survey.fio || 'Не указано',
      age: survey.age || '',
      temperature: survey.temperature || '',
      anamnesis: survey.anamnesis || survey.symptoms || survey.description || '',
      title: this.ensureStringArray(survey.title || survey.diagnosis),
      diagnostic: this.ensureStringArray(survey.diagnostic || survey.examinations),
      treatment: this.ensureStringArray(survey.treatment),
      otherGuidelines: this.ensureStringArray(survey.otherGuidelines),
      survey: survey.survey,
      created_at: survey.created_at
    };
  }

  /**
   * Преобразует строки разделенные запятыми в массивы (для обратной совместимости)
   */
  private commaSeparatedToArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(item => String(item));
    if (typeof value === 'string') {
      return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
    return [String(value)];
  }
}

// Экспортируем синглтон
export const surveysApi = new SurveysApi();

// Экспорт отдельных функций для обратной совместимости
export const saveSurveyToDB = surveysApi.saveSurveyToDB.bind(surveysApi);
export const deleteSurvey = surveysApi.deleteSurvey.bind(surveysApi);
export const getSurveyById = surveysApi.getSurveyById.bind(surveysApi);
export const getDiagnosisRecommendations = surveysApi.getDiagnosisRecommendations.bind(surveysApi);
export const getPaginatedSurveys = surveysApi.getPaginatedSurveys.bind(surveysApi);
export const ensureStringArray = surveysApi.ensureStringArray.bind(surveysApi);

// Экспортируем метод normalizeSurveyData под другим именем чтобы избежать конфликта
export const normalizeSurveyData = surveysApi['normalizeSurveyData'];

export default surveysApi;