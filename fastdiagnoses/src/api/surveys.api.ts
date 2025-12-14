import { fetchClient } from './fetchClient';
import { APIResponse } from '../types/api.types';

/**
 * Получение рекомендаций по диагнозам
 * Точная копия postTitlesForListRecomFromDB
 */
export const getDiagnosisRecommendations = async (titles: string[]): Promise<APIResponse> => {
  try {
    console.log('Запрос рекомендаций для диагнозов:', titles);
    
    const result = await fetchClient.post('/diagnoses/search', { titles });
    
    if (result.success && result.data) {
      // Возвращаем как в вашем rewriteSurveyLocalStorage
      return {
        success: true,
        data: {
          title: result.data.titles,
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
    const result = await fetchClient.post('/auth/verify', { login });
    
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
export const saveSurveyToDB = async (login: string, surveyData: any): Promise<APIResponse> => {
  try {
    console.log('Сохранение опроса для пользователя:', login);
    
    let surveyObj;
    if (typeof surveyData === 'string') {
      surveyObj = JSON.parse(surveyData);
    } else {
      surveyObj = surveyData;
    }
    
    // Дебаг структуры
    console.log('🔍 Дебаг saveSurveyToDB:');
    console.log('1. surveyObj:', surveyObj);
    console.log('2. Ключи:', Object.keys(surveyObj));
    
    // ✅ НЕ добавляем system и symptoms - они не нужны!
    // Просто используем оригинальный объект
    const surveyToSend = { ...surveyObj };
    
    console.log('5. Отправляемый объект:', surveyToSend);
    
    const token = localStorage.getItem('token') || '';
    console.log('6. Токен:', token ? 'есть' : 'нет');
    
    const response = await fetch('http://localhost:5000/api/surveys/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ survey: surveyToSend }) // отправляем как есть
    });
    
    const result = await response.json();
    console.log('7. Ответ сервера:', result);
    
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
    
    const result = await fetchClient.post('/surveys', { login });
    
    if (result.success && result.data) {
      // Обрабатываем как в objectToLIstSurveysAndImages
      console.log(result.data);
      
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
export const deleteSurvey = async (login: string, id: number): Promise<APIResponse> => {
  try {
    console.log('Удаление записи:', id, 'для пользователя:', login);
    
    // DELETE запрос без тела - сервер берет id из URL и login из токена
    const result = await fetchClient.delete(`/surveys/${id}`);
    
    if (result.success) {
      console.log('Запись успешно удалена');
      return {
        success: true,
        message: 'Запись успешно удалена',
        data: result.data
      };
    }
    
    // Возвращаем ошибку от сервера
    return {
      success: false,
      message: result.message || 'Ошибка удаления',
      field: result.field
    };
    
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