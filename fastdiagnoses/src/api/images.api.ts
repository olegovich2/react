import { fetchClient } from './fetchClient';
import { 
  APIResponse, 
  UploadedImage,
  PaginatedImagesResponseData,
  ImageUploadResponse,
  DeleteResponseData
} from '../components/AccountPage/types/account.types';

// Получаем API URL из fetchClient
const API_URL = fetchClient.getBaseURL() || 'http://localhost:5000/api';

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
   * Загрузка изображения (НОВАЯ версия с FormData)
   */
  async uploadImage(file: File, comment: string = '', onProgress?: (progress: number) => void): 
    Promise<ImageUploadResponse> {
    
    return new Promise((resolve, reject) => {
      try {
        console.log(`📤 Загрузка изображения через FormData: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // 1. Создаем FormData
        const formData = new FormData();
        formData.append('image', file);           // Бинарный файл (НЕ Base64!)
        formData.append('filename', file.name);   // Оригинальное имя
        formData.append('comment', comment);      // Комментарий
        
        const token = localStorage.getItem('token') || '';
        
        // 2. Используем XMLHttpRequest для отслеживания прогресса
        const xhr = new XMLHttpRequest();
        
        // Формируем URL (убираем '/api' если fetchClient уже добавляет)
        const endpoint = API_URL.includes('/api') 
          ? `${API_URL}/images/upload`
          : `${API_URL}/api/images/upload`;
        
        xhr.open('POST', endpoint);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        
        // 3. Реальный прогресс загрузки (если нужен)
        if (onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              onProgress(progress);
            }
          };
        }
        
        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);
            
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(response);
            } else {
              reject(new Error(response.message || `Ошибка ${xhr.status}`));
            }
          } catch (error) {
            reject(new Error('Неверный формат ответа сервера'));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error('Ошибка сети при загрузке'));
        };
        
        xhr.ontimeout = () => {
          reject(new Error('Таймаут загрузки (5 минут)'));
        };
        
        xhr.timeout = 300000; // 5 минут таймаут
        
        // 4. Отправляем FormData
        xhr.send(formData);
        
      } catch (error: any) {
        console.error('❌ Ошибка при подготовке загрузки:', error);
        reject(error);
      }
    });
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

// Экспорт отдельных функций
export const uploadImage = imagesApi.uploadImage.bind(imagesApi);
export const deleteImage = imagesApi.deleteImage.bind(imagesApi);
export const getPaginatedImages = imagesApi.getPaginatedImages.bind(imagesApi);
export const getImageForViewPage = imagesApi.getImageForViewPage.bind(imagesApi);
export const getImageUrl = imagesApi.getImageUrl.bind(imagesApi);
export const getThumbnailUrl = imagesApi.getThumbnailUrl.bind(imagesApi);
export const getMimeType = imagesApi.getMimeType.bind(imagesApi);
export const getReadableFileSize = imagesApi.getReadableFileSize.bind(imagesApi);
export const downloadImage = imagesApi.downloadImage.bind(imagesApi);

export default imagesApi;