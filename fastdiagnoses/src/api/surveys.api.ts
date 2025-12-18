// surveys.api.ts (исправленная версия)
import { fetchClient } from './fetchClient';
import { APIResponse } from '../types/api.types';
import { Survey } from '../components/AccountPage/types/account.types';

export const surveysApi = {
  /**
   * Получение опросов пользователя (БЕЗ логина - сервер берет из токена)
   */
  async getUserSurveys(): Promise<APIResponse & { data?: Survey[] }> {
    try {
      console.log('📥 Запрос опросов пользователя...');
      
      const response = await fetchClient.getSurveys();
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data.surveys || [],
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
   * Сохранение опроса в БД (БЕЗ логина - сервер берет из токена)
   */
  async saveSurveyToDB(surveyData: any): Promise<APIResponse> {
    try {
      console.log(`💾 Сохранение опроса...`);
      
      let surveyObj;
      if (typeof surveyData === 'string') {
        surveyObj = JSON.parse(surveyData);
      } else {
        surveyObj = surveyData;
      }
      
      const response = await fetchClient.saveSurvey(surveyObj);
      
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
   * Удаление опроса (БЕЗ логина - сервер берет из токена)
   */
  async deleteSurvey(id: number): Promise<APIResponse> {
    try {
      console.log(`🗑️ Удаление записи ${id}...`);
      
      const result = await fetchClient.deleteSurveyOrImage(id);
      
      if (result.success) {
        console.log('✅ Запись успешно удалена');
        return {
          success: true,
          message: 'Запись успешно удалена',
          data: result.data
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
   * Получение конкретного опроса по ID (БЕЗ логина - сервер берет из токена)
   */
  async getSurveyById(id: number): Promise<APIResponse & { data?: Survey }> {
    try {
      console.log(`🔍 Получение опроса с ID: ${id}`);
      
      const response = await fetchClient.getSurveyById(id);
      
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
   * Получение рекомендаций по диагнозам (публичный эндпоинт - без изменений)
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
      
      const response = await fetchClient.searchDiagnoses(titles);
      
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
   * Получение всех данных пользователя (БЕЗ логина - сервер берет из токена)
   */
  async getAllUserData(): Promise<APIResponse & { data?: { surveys: Survey[], images: any[] } }> {
    try {
      console.log('📊 Запрос всех данных пользователя...');
      
      const response = await fetchClient.getAllUserData();
      
      if (response.success && response.data) {
        return {
          success: true,
          data: {
            surveys: response.data.surveys || [],
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
  }
};

// Экспорт отдельных функций для обратной совместимости
export const getUserSurveys = surveysApi.getUserSurveys;
export const saveSurveyToDB = surveysApi.saveSurveyToDB;
export const deleteSurvey = surveysApi.deleteSurvey;
export const getSurveyById = surveysApi.getSurveyById;
export const getDiagnosisRecommendations = surveysApi.getDiagnosisRecommendations;
export const getAllUserData = surveysApi.getAllUserData;

// Экспорт объекта API для использования в модульном стиле
export default surveysApi;