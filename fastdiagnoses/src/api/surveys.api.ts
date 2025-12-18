// surveys.api.ts (исправленная версия с правильными типами)
import { fetchClient } from './fetchClient';
import { 
  APIResponse,
  Survey
} from '../components/AccountPage/types/account.types';

// ==================== ЛОКАЛЬНЫЕ ТИПЫ ====================

// Тип для сырых данных опроса с сервера
interface ServerSurveyData {
  id: number;
  date: string;
  survey: Survey; // Сервер УЖЕ парсит JSON и возвращает Survey объект!
}

// Тип для пагинированного ответа сервера
interface ServerPaginatedSurveysData {
  surveys: ServerSurveyData[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Тип для единого ответа сервера
interface ServerSingleSurveyData {
  survey: Survey;
}

// ==================== API МЕТОДЫ ====================

export const surveysApi = {
  /**
   * Получение ВСЕХ опросов пользователя (старый endpoint, без пагинации)
   * Используется только для обратной совместимости
   */
  async getUserSurveys(): Promise<APIResponse & { data?: Survey[] }> {
    try {
      console.log('📥 [DEPRECATED] Запрос ВСЕХ опросов пользователя...');
      
      const response = await fetchClient.post<{ surveys: ServerSurveyData[] }>(
        '/surveys', 
        {}
      );
      
      if (response.success && response.data) {
        // Извлекаем Survey объекты из ответа сервера
        const surveys = response.data.surveys.map((row: ServerSurveyData) => row.survey);
        
        return {
          success: true,
          data: surveys,
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения опросов',
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения опросов:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения опросов',
      };
    }
  },

  /**
   * Получение опросов с пагинацией (ОСНОВНОЙ МЕТОД)
   */
  async getPaginatedSurveys(params?: {
    page?: number;
    limit?: number;
  }): Promise<APIResponse & { 
    data?: {
      surveys: Survey[];
      pagination: ServerPaginatedSurveysData['pagination'];
    }
  }> {
    try {
      const page = params?.page || 1;
      const limit = params?.limit || 5;
      
      console.log(`📥 Запрос опросов с пагинацией: страница ${page}, лимит ${limit}`);
      
      const response = await fetchClient.post<ServerPaginatedSurveysData>(
        '/surveys/paginated', 
        { page, limit }
      );
      
      if (response.success && response.data) {
        console.log(`✅ Получено ${response.data.surveys?.length || 0} опросов с пагинацией`);
        
        // Извлекаем Survey объекты из ответа сервера
        const surveys = response.data.surveys.map((row: ServerSurveyData) => row.survey);
        
        return {
          success: true,
          data: {
            surveys,
            pagination: response.data.pagination
          },
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения опросов с пагинацией',
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения опросов с пагинацией:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения опросов с пагинацией',
      };
    }
  },

  /**
   * Сохранение опроса в БД
   */
  async saveSurveyToDB(surveyData: Survey | string): Promise<APIResponse> {
    try {
      console.log(`💾 Сохранение опроса...`);
      
      // Убеждаемся, что это объект Survey
      let surveyObj: Survey;
      if (typeof surveyData === 'string') {
        surveyObj = JSON.parse(surveyData);
      } else {
        surveyObj = surveyData;
      }
      
      // Сервер ожидает { survey: Survey }
      const response = await fetchClient.post<{ message: string }>(
        '/surveys/save', 
        { survey: surveyObj }
      );
      
      return response;
      
    } catch (error: any) {
      console.error('❌ Ошибка сохранения опроса:', error);
      return {
        success: false,
        message: error.message || 'Ошибка сохранения опроса'
      };
    }
  },

  /**
   * Удаление опроса
   */
  async deleteSurvey(id: number): Promise<APIResponse> {
    try {
      console.log(`🗑️ Удаление записи ${id}...`);
      
      const result = await fetchClient.delete<{ message: string }>(`/data/${id}`);
      
      if (result.success) {
        console.log('✅ Запись успешно удалена');
        return {
          success: true,
          message: 'Запись успешно удалена',
        };
      }
      
      return {
        success: false,
        message: result.message || 'Ошибка удаления',
        field: result.field
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка удаления:', error);
      return {
        success: false,
        message: error.message || 'Ошибка удаления'
      };
    }
  },

  /**
   * Получение конкретного опроса по ID
   */
  async getSurveyById(id: number): Promise<APIResponse & { data?: Survey }> {
    try {
      console.log(`🔍 Получение опроса с ID: ${id}`);
      
      const response = await fetchClient.get<ServerSingleSurveyData>(`/surveys/${id}`);
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data.survey,
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения опроса',
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения опроса:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения опроса',
      };
    }
  },

  /**
   * Получение рекомендаций по диагнозам
   */
  async getDiagnosisRecommendations(titles: string[]): Promise<APIResponse & { 
    data?: { 
      title: string[]; 
      diagnostic: string[]; 
      treatment: string[] 
    } 
  }> {
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
          }
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения рекомендаций',
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения рекомендаций:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения рекомендаций',
      };
    }
  },

  /**
   * Получение всех данных пользователя (опросы + изображения)
   * Старый метод для обратной совместимости
   */
  async getAllUserData(): Promise<APIResponse & { 
    data?: { surveys: Survey[], images: any[] } 
  }> {
    try {
      console.log('📊 [DEPRECATED] Запрос всех данных пользователя...');
      
      const response = await fetchClient.post<{ 
        surveys: ServerSurveyData[], 
        images: any[] 
      }>('/surveys/old', {});
      
      if (response.success && response.data) {
        const surveys = response.data.surveys.map((row: ServerSurveyData) => row.survey);
        
        return {
          success: true,
          data: {
            surveys: surveys,
            images: response.data.images || []
          }
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения данных',
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения всех данных:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения данных',
      };
    }
  },

  // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

  /**
   * Гарантирует, что значение является массивом строк
   */
  ensureStringArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((item: any) => String(item).trim()).filter((item: string) => item.length > 0);
    }
    if (typeof value === 'string') {
      // Если строка содержит запятые, разбиваем
      if (value.includes(',')) {
        return value.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);
      }
      // Иначе возвращаем как массив с одним элементом
      return [value.trim()].filter((item: string) => item.length > 0);
    }
    return [String(value)].filter((item: string) => item.length > 0);
  },

  /**
   * Нормализует Survey объект (для обратной совместимости)
   */
  normalizeSurvey(survey: any): Survey {
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
      // Для обратной совместимости
      survey: survey.survey,
      created_at: survey.created_at
    };
  }
};

// ==================== ЭКСПОРТ ====================

// Экспорт отдельных функций
export const getUserSurveys = surveysApi.getUserSurveys;
export const getPaginatedSurveys = surveysApi.getPaginatedSurveys;
export const saveSurveyToDB = surveysApi.saveSurveyToDB;
export const deleteSurvey = surveysApi.deleteSurvey;
export const getSurveyById = surveysApi.getSurveyById;
export const getDiagnosisRecommendations = surveysApi.getDiagnosisRecommendations;
export const getAllUserData = surveysApi.getAllUserData;

// Экспорт вспомогательных методов (для тестирования)
export const ensureStringArray = surveysApi.ensureStringArray;
export const normalizeSurvey = surveysApi.normalizeSurvey;

export default surveysApi;