import { fetchClient } from './fetchClient';
import { APIResponse } from '../types/api.types';

/**
 * Получение рекомендаций по диагнозам
 * Точная копия postTitlesForListRecomFromDB
 */
export const getDiagnosisRecommendations = async (titles: string[]): Promise<APIResponse> => {
  try {
    console.log('Запрос рекомендаций для диагнозов:', titles);
    
    const result = await fetchClient.post('/searchDiagnoses', { titles });
    
    if (result.success && result.data) {
      // Возвращаем как в вашем rewriteSurveyLocalStorage
      return {
        success: true,
        data: {
          title: titles,
          diagnostic: result.data.diagnostic || [],
          treatment: result.data.treatment || []
        }
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка получения рекомендаций:', error);
    return {
      success: false,
      message: error.message || 'Ошибка получения рекомендаций'
    };
  }
};

/**
 * Проверка существования БД пользователя
 * Точная копия justAsk из allFunctionsForWorkMain.js
 */
export const checkUserDatabase = async (login: string): Promise<APIResponse> => {
  try {
    const result = await fetchClient.post('/justAsk', { login });
    
    if (result.success) {
      return {
        success: true,
        message: 'База данных существует или создана'
      };
    }
    
    return result;
    
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Ошибка проверки БД'
    };
  }
};

/**
 * Сохранение опроса в БД
 * Точная копия postSurveyToPersonalDB
 */
export const saveSurveyToDB = async (login: string, survey: string): Promise<APIResponse> => {
  try {
    console.log('Сохранение опроса для пользователя:', login);
    
    // 1. Сначала проверяем/создаем БД
    const checkResult = await checkUserDatabase(login);
    
    if (!checkResult.success) {
      return checkResult;
    }
    
    // 2. Сохраняем опрос
    const result = await fetchClient.post('/toPersonalDB', { login, survey });
    
    if (result.success) {
      return {
        success: true,
        message: 'Опрос успешно сохранен в личном кабинете'
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка сохранения опроса:', error);
    return {
      success: false,
      message: error.message || 'Ошибка сохранения опроса'
    };
  }
};

/**
 * Получение всех опросов пользователя
 * Точная копия getSurveysAndImages
 */
export const getUserSurveys = async (login: string): Promise<APIResponse> => {
  try {
    console.log('Запрос опросов для:', login);
    
    const result = await fetchClient.post('/getSurveys', { login });
    
    if (result.success && result.data) {
      // Обрабатываем как в objectToLIstSurveysAndImages
      return {
        success: true,
        data: {
          surveys: result.data.surveys || {},
          images: result.data.images || {}
        }
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка получения опросов:', error);
    return {
      success: false,
      message: error.message || 'Ошибка получения опросов'
    };
  }
};

/**
 * Удаление опроса или изображения
 * Точная копия deleteSurveysAndImages
 */
export const deleteSurvey = async (login: string, id: string): Promise<APIResponse> => {
  try {
    console.log('Удаление записи:', id, 'для пользователя:', login);
    
    const result = await fetchClient.post('/deleteRow', { login, id });
    
    if (result.success) {
      // После удаления обновляем список как в вашем коде
      const updatedSurveys = await getUserSurveys(login);
      return {
        success: true,
        message: 'Запись успешно удалена',
        data: updatedSurveys.data
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка удаления:', error);
    return {
      success: false,
      message: error.message || 'Ошибка удаления'
    };
  }
};

/**
 * Получение оригинального изображения
 * Точная копия getOriginImage
 */
export const getOriginalImage = async (login: string, id: string): Promise<APIResponse> => {
  try {
    const result = await fetchClient.post('/originImage', { login, id });
    
    if (result.success && result.data) {
      // Сохраняем в localStorage как в вашем коде
      localStorage.setItem('originImage', JSON.stringify(result.data));
      
      return {
        success: true,
        data: result.data,
        message: 'Изображение получено'
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка получения изображения:', error);
    return {
      success: false,
      message: error.message || 'Ошибка получения изображения'
    };
  }
};