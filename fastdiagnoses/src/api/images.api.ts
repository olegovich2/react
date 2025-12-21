import { fetchClient } from './fetchClient';
import { 
  APIResponse, 
  UploadedImage,
  PaginatedImagesResponseData,
  ImageUploadResponse,
  DeleteResponseData
} from '../components/AccountPage/types/account.types';

export const imagesApi = {
  
  /**
   * Получение изображений с пагинацией
   */
  async getPaginatedImages(params?: {
    page?: number;
    limit?: number;
  }): Promise<APIResponse & { 
    data?: {
      images: UploadedImage[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    }
  }> {
    try {
      // Сервер возвращает { images: [], pagination: {} }
      const response = await fetchClient.post<PaginatedImagesResponseData>(
        '/images/paginated', 
        params || {}
      );
      
      if (response.success && response.data) {
        console.log(`✅ Получено ${response.data.images?.length || 0} изображений с пагинацией`);
        
        return {
          success: true,
          data: {
            images: response.data.images,
            pagination: response.data.pagination
          },
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения изображений',
      };
      
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
  async uploadImage(file: File, comment?: string): Promise<APIResponse & { 
    data?: {
      fileUuid?: string;
      thumbnailUrl?: string;
      originalUrl?: string;
    } 
  }> {
    try {
      console.log(`📤 Загрузка изображения: ${file.name}`);
      
      const base64Data = await convertFileToBase64(file);
      
      // Сервер возвращает ImageUploadResponse
      const result = await fetchClient.uploadImageBase64(
        file.name,
        base64Data,
        comment || ''
      ) as APIResponse & { data?: ImageUploadResponse };
      
      if (result.success) {
        console.log(`✅ Изображение ${file.name} успешно загружено`);
        
        return {
          success: true,
          message: 'Изображение успешно загружено',
          data: result.data ? {
            fileUuid: result.data.fileUuid,
            thumbnailUrl: result.data.thumbnailUrl,
            originalUrl: result.data.originalUrl
          } : undefined
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
      
      const response = await fetchClient.deleteSurveyOrImage(id) as APIResponse & { data?: DeleteResponseData };
      
      return {
        success: response.success,
        message: response.message,
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка удаления изображения:', error);
      return {
        success: false,
        message: error.message || 'Ошибка удаления изображения',
      };
    }
  },

  /**
 * Получение изображения для страницы просмотра по UUID
 */
async getImageForViewPage(uuid: string): Promise<APIResponse & {
  data?: UploadedImage
}> {
  try {
    console.log(`🔍 Получение изображения по UUID: ${uuid}`);
    
    // Получаем оригинальное изображение через серверный эндпоинт
    const originalResponse = await fetchClient.get<{
      success: boolean;
      originalUrl?: string;
      filename?: string;
      fileUuid?: string;
      id?: number;      
    }>(`/images/original/${uuid}`);
    
    if (originalResponse.success && originalResponse.data) {
      const responseData = originalResponse.data;
      console.log(responseData.id, originalResponse.data, '----------- originalResponse.data');
      
      
      // Формируем объект UploadedImage на основе полученных данных
      const imageData: UploadedImage = {
        id: responseData.id || 0, // ID не возвращается в текущем эндпоинте
        fileUuid: responseData.fileUuid || uuid,
        fileName: responseData.filename || 'Изображение',
        originalUrl: responseData.originalUrl || '',
        thumbnailUrl: responseData.thumbnailUrl || responseData.originalUrl || '',
        comment: responseData.comment || '',
        fileSize: responseData.fileSize || 0,
        dimensions: responseData.dimensions || 
                   (responseData.width && responseData.height ? 
                    `${responseData.width}x${responseData.height}` : null),
        created_at: responseData.created_at || new Date().toISOString(),
        isFileOnDisk: true,
        storedFilename: responseData.storedFilename || responseData.filename || ''
      };
      
      return {
        success: true,
        data: imageData,
      };
    }
    
    return {
      success: false,
      message: originalResponse.message || 'Изображение не найдено',
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
   * ТОЛЬКО ФАЙЛОВАЯ СИСТЕМА
   */
  getImageUrl(image: UploadedImage): string {
    if (!image) {
      console.warn('❌ Нет данных изображения');
      return '';
    }
    
    // ПРИОРИТЕТ 1: originalUrl от сервера
    if (image.originalUrl) {
      return image.originalUrl;
    }
    
    // ПРИОРИТЕТ 2: thumbnailUrl как fallback
    if (image.thumbnailUrl) {
      console.warn('⚠️ Нет originalUrl, используем thumbnailUrl');
      return image.thumbnailUrl;
    }
    
    console.error('❌ Ошибка: изображение не имеет URL (файловая система)', image);
    return '';
  },

  /**
   * Формирование URL для превью
   * ТОЛЬКО ФАЙЛОВАЯ СИСТЕМА
   */
  getThumbnailUrl(image: UploadedImage): string {
    if (!image) {
      console.warn('❌ Нет данных изображения для превью');
      return '';
    }
    
    // ПРИОРИТЕТ 1: thumbnailUrl от сервера
    if (image.thumbnailUrl) {
      return image.thumbnailUrl;
    }
    
    // ПРИОРИТЕТ 2: Основное изображение как fallback
    console.warn('⚠️ Нет thumbnailUrl, используем оригинал');
    return imagesApi.getImageUrl(image);
  },

  /**
   * Определение MIME типа по имени файла
   */
  getMimeType(filename: string): string {
    if (!filename) return 'image/jpeg';
    
    const parts = filename.toLowerCase().split('.');
    const ext = parts.length > 1 ? parts[parts.length - 1] : '';
    
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
   * Получение размера файла в читаемом формате
   */
  getReadableFileSize(image: UploadedImage): string {
    if (!image || !image.fileSize) {
      return 'Неизвестно';
    }
    
    const bytes = image.fileSize;
    
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  },

  /**
   * Скачивание изображения
   */
  /**
 * Скачивание изображения
 */
async downloadImage(image: UploadedImage): Promise<void> {
  try {
    if (!image || !image.originalUrl) {
      throw new Error('Нет данных изображения или URL для скачивания');
    }

    // Преобразуем относительный URL в абсолютный если нужно
    let downloadUrl = image.originalUrl;
    
    if (downloadUrl.startsWith('/')) {
      // Относительный путь → делаем абсолютным
      downloadUrl = window.location.origin + downloadUrl;
    }
        
    // Создаем временную ссылку с атрибутом download
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    // Устанавливаем имя файла для скачивания
    const fileName = image.fileName || 
                    (image.storedFilename ? 
                     image.storedFilename.split('/').pop() : 'image.jpg') || 
                    'image.jpg';
    
    // ВАЖНО: атрибут download заставляет браузер скачивать файл
    link.download = fileName;
    link.setAttribute('download', fileName);
    
    // Дополнительные атрибуты для безопасности
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    // Добавляем в DOM и кликаем
    document.body.appendChild(link);
    link.click();
    
    // Убираем ссылку из DOM
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
    
  } catch (error) {
    console.error('❌ Ошибка при скачивании изображения:', error);
    throw error;
  }
}
};

// Вспомогательная функция
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
// export const getUserImages = imagesApi.getUserImages;
export const uploadImage = imagesApi.uploadImage;
export const deleteImage = imagesApi.deleteImage;
export const getPaginatedImages = imagesApi.getPaginatedImages;
export const getImageForViewPage = imagesApi.getImageForViewPage;
export const getImageUrl = imagesApi.getImageUrl;
export const getThumbnailUrl = imagesApi.getThumbnailUrl;
export const getMimeType = imagesApi.getMimeType;
export const getReadableFileSize = imagesApi.getReadableFileSize;
export const downloadImage = imagesApi.downloadImage;

export default imagesApi;