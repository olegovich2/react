import { fetchClient } from './fetchClient';
import { APIResponse } from '../types/api.types';

/**
 * API для работы с изображениями
 * Точная копия логики из ваших requests.js и logicPage.js
 */

/**
 * Загрузка изображения на сервер через WebSocket + HTTP
 * Точная копия downloadFileToServer из requests.js
 */
export const uploadImageToServer = async (data: any): Promise<APIResponse> => {
  try {
    console.log('Загрузка изображения:', data.filename);
    
    const result = await fetchClient.post('/downloadToServer', data);
    
    if (result.success) {
      return {
        success: true,
        message: 'Изображение успешно загружено'
      };
    }
    
    // Если был редирект (например, на страницу входа)
    if (result.redirected) {
      return {
        success: false,
        message: 'Требуется повторная авторизация',
        redirected: true
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка загрузки изображения:', error);
    return {
      success: false,
      message: error.message || 'Ошибка загрузки изображения'
    };
  }
};

/**
 * Получение оригинального изображения
 * Точная копия getOriginImage из requests.js
 */
export const getOriginalImage = async (login: string, id: string): Promise<APIResponse> => {
  try {
    console.log('Запрос оригинального изображения:', id, 'для пользователя:', login);
    
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
    
    // Если был редирект
    if (result.redirected) {
      return {
        success: false,
        message: 'Требуется повторная авторизация',
        redirected: true
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

/**
 * Удаление изображения
 * Точная копия deleteSurveysAndImages для изображений
 */
export const deleteImage = async (login: string, id: string): Promise<APIResponse> => {
  try {
    console.log('Удаление изображения:', id, 'для пользователя:', login);
    
    const result = await fetchClient.post('/deleteRow', { login, id });
    
    if (result.success) {
      return {
        success: true,
        message: 'Изображение успешно удалено'
      };
    }
    
    // Если был редирект
    if (result.redirected) {
      return {
        success: false,
        message: 'Требуется повторная авторизация',
        redirected: true
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка удаления изображения:', error);
    return {
      success: false,
      message: error.message || 'Ошибка удаления изображения'
    };
  }
};

/**
 * Получение всех изображений пользователя
 * Используется внутри getUserSurveys, но можно отдельно
 */
export const getUserImages = async (login: string): Promise<APIResponse> => {
  try {
    const result = await fetchClient.post('/getSurveys', { login });
    
    if (result.success && result.data) {
      // Извлекаем только изображения как в objectToLIstSurveysAndImages
      const imagesData = result.data.images || {};
      const imagesArray = Object.keys(imagesData).map(key => ({
        id: key,
        ...imagesData[key]
      }));
      
      return {
        success: true,
        data: imagesArray,
        message: 'Изображения получены'
      };
    }
    
    // Если был редирект
    if (result.redirected) {
      return {
        success: false,
        message: 'Требуется повторная авторизация',
        redirected: true
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка получения изображений:', error);
    return {
      success: false,
      message: error.message || 'Ошибка получения изображений'
    };
  }
};

/**
 * Вспомогательная функция: конвертация ArrayBuffer в Base64
 * Точная копия функции из logicPage.js
 */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

/**
 * Вспомогательная функция: чтение файла как ArrayBuffer
 * Для подготовки к загрузке через WebSocket
 */
export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as ArrayBuffer);
      } else {
        reject(new Error('Не удалось прочитать файл'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Подготовка данных изображения для отправки
 * Точная копия логики из getDataFromForm в logicPage.js
 */
export interface ImageUploadData {
  websocketid: string;
  filename: string;
  comment: string;
  file: string; // base64
}

export const prepareImageForUpload = async (
  file: File,
  comment: string,
  websocketId: string
): Promise<ImageUploadData> => {
  try {
    // Читаем файл как ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // Конвертируем в Base64
    const base64Data = arrayBufferToBase64(arrayBuffer);
    
    // Создаем объект как в вашем коде
    return {
      websocketid: websocketId,
      filename: file.name,
      comment: comment,
      file: base64Data
    };
    
  } catch (error) {
    throw new Error(`Ошибка подготовки файла: ${error}`);
  }
};

/**
 * Обновление прогресс бара (как в logicPage.js)
 */
export const updateProgressBar = (
  value: number,
  when: 'request' | 'write',
  progressBarElement?: HTMLElement
): void => {
  if (!progressBarElement) return;
  
  if (when === 'request') {
    progressBarElement.style.width = `${Number(value) / 2}%`;
  } else if (when === 'write') {
    progressBarElement.style.width = `${value}%`;
  }
};

/**
 * Получение данных пользователя из localStorage
 * Как в вашем коде: JSON.parse(localStorage.getItem('user'))
 */
export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return null;
  }
};