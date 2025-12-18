import { fetchClient } from './fetchClient';
import { APIResponse, UploadedImage } from '../components/AccountPage/types/account.types';

export const imagesApi = {
  /**
   * Получение изображений пользователя с поддержкой файловой системы
   */
  async getUserImages(): Promise<APIResponse & { data?: UploadedImage[] }> {
    try {
      console.log('📥 Запрос изображений пользователя (новая версия)...');
      
      const response = await fetchClient.post<{
        images: UploadedImage[];
      }>('/images', {});
      
      if (response.success && response.data) {
        console.log(`✅ Получено ${response.data.images?.length || 0} изображений`);
        
        // Проверяем, есть ли у изображений URL для файловой системы
        const imagesWithUrls = response.data.images.map((img: UploadedImage) => {
          // Если есть URL для файловой системы, используем его
          if (img.imageUrl) {
            console.log(`🖼️ Изображение ${img.fileName} имеет URL: ${img.imageUrl}`);
          } else if (img.originIMG) {
            console.log(`🖼️ Изображение ${img.fileName} использует Base64`);
          }
          
          return img;
        });
        
        return {
          success: true,
          data: imagesWithUrls,
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
   * Получение изображений с пагинацией
   */
  async getPaginatedImages(params?: {
    page?: number;
    limit?: number;
  }): Promise<APIResponse & { 
    data?: {
      images: UploadedImage[];
      pagination: any;
    }
  }> {
    try {
      const response = await fetchClient.getPaginatedImages(params);
      return response;
    } catch (error: any) {
      console.error('❌ Ошибка получения изображений с пагинацией:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения изображений',
      };
    }
  },

  /**
   * Загрузка изображения
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
   * Удаление изображения
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
   * Получение конкретного изображения по ID
   */
  async getImageById(id: number): Promise<APIResponse & { 
    data?: { 
      filename: string, 
      image?: string,
      imageUrl?: string,
      isFileOnDisk?: boolean,
      fileUuid?: string,
      thumbnailUrl?: string,
      fileSize?: number,
      dimensions?: string
    } 
  }> {
    try {
      console.log(`🔍 Получение изображения с ID: ${id}`);
      
      const response = await fetchClient.get(`/images/${id}`);
      
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
  },

  /**
   * Формирование URL для доступа к файлу на сервере
   */
  getImageUrl(image: UploadedImage): string {
    // Если нет изображения, возвращаем пустую строку
    if (!image) {
      console.warn('⚠️ Нет данных изображения');
      return '';
    }

    // Если есть URL к файлу на диске, используем его
    if (image.imageUrl) {
      // Проверяем, не является ли это уже полным URL
      if (image.imageUrl.startsWith('http') || image.imageUrl.startsWith('/')) {
        return image.imageUrl;
      }
      // Если относительный путь, добавляем базовый URL
      const baseURL = fetchClient.getBaseURL();
      const apiBase = baseURL.replace('/api', '');
      return `${apiBase}${image.imageUrl}`;
    }
    
    // Если есть Base64, используем его (для совместимости)
    if (image.originIMG) {
      const mimeType = this.getMimeType(image.fileName);
      return `data:${mimeType};base64,${image.originIMG}`;
    }
    
    // Если есть thumbnail URL как fallback
    if (image.thumbnailUrl) {
      if (image.thumbnailUrl.startsWith('http') || image.thumbnailUrl.startsWith('/')) {
        return image.thumbnailUrl;
      }
      const baseURL = fetchClient.getBaseURL();
      const apiBase = baseURL.replace('/api', '');
      return `${apiBase}${image.thumbnailUrl}`;
    }
    
    // Fallback - пустая строка
    console.warn(`⚠️ Нет данных для изображения: ${image.fileName}`);
    return '';
  },

  /**
   * Формирование URL для превью
   */
  getThumbnailUrl(image: UploadedImage): string {
    // Если нет изображения, возвращаем пустую строку
    if (!image) {
      return '';
    }

    // Если есть URL к превью на диске, используем его
    if (image.thumbnailUrl) {
      if (image.thumbnailUrl.startsWith('http') || image.thumbnailUrl.startsWith('/')) {
        return image.thumbnailUrl;
      }
      const baseURL = fetchClient.getBaseURL();
      const apiBase = baseURL.replace('/api', '');
      return `${apiBase}${image.thumbnailUrl}`;
    }
    
    // Если есть Base64 превью, используем его
    if (image.smallImage) {
      return `data:image/jpeg;base64,${image.smallImage}`;
    }
    
    // Если есть основное изображение в Base64
    if (image.originIMG) {
      return `data:image/jpeg;base64,${image.originIMG}`;
    }
    
    // Fallback - используем основное изображение
    return this.getImageUrl(image);
  },

  /**
   * Определение MIME типа по имени файла
   */
  getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      case 'tiff':
      case 'tif':
        return 'image/tiff';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  },

  /**
   * Проверка, использует ли изображение файловую систему
   */
  isUsingFileSystem(image: UploadedImage): boolean {
    return !!(image.imageUrl || image.isFileOnDisk);
  },

  /**
   * Получение размера файла в читаемом формате
   */
  getReadableFileSize(image: UploadedImage): string {
    if (!image.fileSize) {
      return 'Неизвестно';
    }
    
    if (image.fileSize < 1024) {
      return `${image.fileSize} B`;
    } else if (image.fileSize < 1024 * 1024) {
      return `${(image.fileSize / 1024).toFixed(2)} KB`;
    } else {
      return `${(image.fileSize / (1024 * 1024)).toFixed(2)} MB`;
    }
  },

  /**
   * Проверка доступности изображения
   */
  async checkImageAvailability(image: UploadedImage): Promise<boolean> {
    try {
      const imageUrl = this.getImageUrl(image);
      if (!imageUrl) return false;
      
      // Для URL файловой системы проверяем доступность
      if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        return response.ok;
      }
      
      // Для Base64 всегда доступно
      if (imageUrl.startsWith('data:')) {
        return true;
      }
      
      return false;
    } catch {
      return false;
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

// Экспорт отдельных функций
export const getUserImages = imagesApi.getUserImages;
export const uploadImage = imagesApi.uploadImage;
export const deleteImage = imagesApi.deleteImage;
export const getImageById = imagesApi.getImageById;
export const getImageUrl = imagesApi.getImageUrl;
export const getThumbnailUrl = imagesApi.getThumbnailUrl;
export const getMimeType = imagesApi.getMimeType;
export const getReadableFileSize = imagesApi.getReadableFileSize;
export const isUsingFileSystem = imagesApi.isUsingFileSystem;

export default imagesApi;