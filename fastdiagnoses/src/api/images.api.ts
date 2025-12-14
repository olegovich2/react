import { fetchClient } from './fetchClient';

/**
 * Сервис для работы с изображениями через REST API
 * Вместо сложного WebSocket используем простые POST запросы
 */

/**
 * Конвертация файла в Base64
 */
export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Убираем префикс "data:image/jpeg;base64,"
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Загрузка изображения на сервер
 */
export const uploadImage = async (
  file: File, 
  comment?: string
) => {
  try {
    console.log(`📤 Начало загрузки файла: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    
    // Конвертируем в Base64
    const base64Data = await convertFileToBase64(file);
    
    // Отправляем на сервер
    const result = await fetchClient.uploadImageBase64(
      file.name,
      base64Data,
      comment || ''
    );
    
    if (result.success) {
      console.log(`✅ Файл ${file.name} успешно загружен`);
      return {
        success: true,
        message: 'Изображение успешно загружено',
        filename: file.name
      };
    } else {
      console.error(`❌ Ошибка загрузки файла ${file.name}:`, result.message);
      return {
        success: false,
        message: result.message || 'Ошибка загрузки файла'
      };
    }
  } catch (error: any) {
    console.error('❌ Ошибка при загрузке файла:', error);
    return {
      success: false,
      message: error.message || 'Неизвестная ошибка при загрузке файла'
    };
  }
};

/**
 * Получение изображения по ID
 */
export const getImage = async (id: number) => {
  return fetchClient.getImage(id);
};

/**
 * Получение списка всех изображений пользователя
 */
// images.api.ts
export const getUserImages = async (): Promise<any> => {
  try {
    console.log('📥 Запрос изображений пользователя...');
    
    // Используем прямой запрос вместо getSurveys()
    const response = await fetchClient.get('/api/surveys');
    console.log('📊 Прямой ответ от /api/surveys:', response);
    
    if (response.success) {
      // Сервер возвращает images прямо в response, а не в response.data
      const images = response.data.images || (response.data && response.data.images) || [];
      console.log(`🖼️  Изображения получены:`, images.length, 'шт.');
      console.log('📝 Первое изображение:', images[0]);
      
      return {
        success: true,
        images: images
      };
    }
    
    console.warn('⚠️  Сервер вернул неуспешный ответ:', response);
    return {
      success: false,
      message: response.message || 'Не удалось получить изображения'
    };
    
  } catch (error: any) {
    console.error('❌ Ошибка получения изображений:', error);
    return {
      success: false,
      message: error.message || 'Ошибка получения изображений'
    };
  }
};

/**
 * Удаление изображения
 */
export const deleteImage = async (id: number) => {
  return fetchClient.deleteSurveyOrImage(id);
};

/**
 * Проверка размера файла перед загрузкой
 */
export const validateFile = (file: File): { valid: boolean; message?: string } => {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      message: `Файл слишком большой. Максимальный размер: ${(MAX_SIZE / 1024 / 1024).toFixed(1)}MB`
    };
  }
  
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      message: 'Недопустимый формат файла. Разрешены: JPG, PNG, GIF, BMP'
    };
  }
  
  return { valid: true };
};