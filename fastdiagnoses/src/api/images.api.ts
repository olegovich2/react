// images.api.ts (исправленная версия)
import { fetchClient } from './fetchClient';
import { APIResponse } from '../types/api.types';
import { UploadedImage } from '../types/api.types';

export const imagesApi = {
  /**
   * Получение изображений пользователя (БЕЗ логина - сервер берет из токена)
   */
  async getUserImages(): Promise<APIResponse & { data?: UploadedImage[] }> {
    try {
      console.log('📥 Запрос изображений пользователя...');
      
      const response = await fetchClient.getImages();
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data.images || [],
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения изображений',
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения изображений:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения изображений',
      };
    }
  },

  /**
   * Загрузка изображения на сервер (БЕЗ логина - сервер берет из токена)
   */
  async uploadImage(file: File, comment?: string): Promise<APIResponse> {
    try {
      console.log(`📤 Загрузка изображения: ${file.name}`);
      
      const base64Data = await convertFileToBase64(file);
      
      const result = await fetchClient.uploadImageBase64(
        file.name,
        base64Data,
        comment || ''
      );
      
      if (result.success) {
        console.log(`✅ Изображение ${file.name} успешно загружено`);
        return {
          success: true,
          message: 'Изображение успешно загружено',
        };
      } else {
        return {
          success: false,
          message: result.message || 'Ошибка загрузки изображения',
        };
      }
    } catch (error: any) {
      console.error('❌ Ошибка загрузки изображения:', error);
      return {
        success: false,
        message: error.message || 'Неизвестная ошибка при загрузке файла',
      };
    }
  },

  /**
   * Удаление изображения (БЕЗ логина - сервер берет из токена)
   */
  async deleteImage(id: number): Promise<APIResponse> {
    try {
      console.log(`🗑️ Удаление изображения ${id}...`);
      
      const response = await fetchClient.deleteSurveyOrImage(id);
      
      return response;
      
    } catch (error: any) {
      console.error('❌ Ошибка удаления изображения:', error);
      return {
        success: false,
        message: error.message || 'Ошибка удаления изображения',
      };
    }
  },

  /**
   * Получение конкретного изображения по ID (БЕЗ логина - сервер берет из токена)
   */
  async getImageById(id: number): Promise<APIResponse & { data?: { filename: string, image: string } }> {
    try {
      console.log(`🔍 Получение изображения с ID: ${id}`);
      
      const response = await fetchClient.getImageById(id);
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data,
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения изображения',
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения изображения:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения изображения',
      };
    }
  }
};

const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Экспорт отдельных функций для обратной совместимости
export const getUserImages = imagesApi.getUserImages;
export const uploadImage = imagesApi.uploadImage;
export const deleteImage = imagesApi.deleteImage;
export const getImageById = imagesApi.getImageById;

// Экспорт объекта API для использования в модульном стиле
export default imagesApi;