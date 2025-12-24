import { fetchClient } from './fetchClient';
import { BaseApiService, APIResponse, PaginationInfo } from './BaseApiService';
import { userDataService } from '../services';
import { 
  UploadedImage,
  ImageUploadResponse,
  normalizeImage
} from '../components/AccountPage/types/account.types';

// Получаем API URL из fetchClient
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * API сервис для работы с изображениями
 */
class ImagesApi extends BaseApiService<UploadedImage> {
  protected endpoint = '/images/paginated';
  protected entityName = 'изображений';

  // ==================== РЕАЛИЗАЦИЯ АБСТРАКТНЫХ МЕТОДОВ ====================

  protected extractItems(data: any): any[] {
    // Сервер возвращает { images: [...], pagination: {...} }
    return data.images || [];
  }

  protected processItems(items: any[]): UploadedImage[] {
    return items.map((item: any) => this.normalizeImageData(item));
  }

  protected extractSingleItem(data: any): any {
    return data.image || data;
  }

  protected processSingleItem(item: any): UploadedImage {
    return this.normalizeImageData(item);
  }

  // ==================== ПУБЛИЧНЫЕ МЕТОДЫ ДЛЯ ИЗОБРАЖЕНИЙ ====================

  /**
   * Загрузка изображения (публичный метод с XMLHttpRequest)
   */
  async uploadImage(file: File, comment: string = '', onProgress?: (progress: number) => void): 
    Promise<ImageUploadResponse> {
    
    return new Promise((resolve, reject) => {
      try {
        console.log(`📤 Загрузка изображения через FormData: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('filename', file.name);
        formData.append('comment', comment);
        
        const token = userDataService.getToken();
        
        const xhr = new XMLHttpRequest();
        
        const endpoint = API_URL.includes('/api') 
          ? `${API_URL}/images/upload`
          : `${API_URL}/api/images/upload`;
        
        xhr.open('POST', endpoint);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        
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
        
        xhr.timeout = 300000;
        
        xhr.send(formData);
        
      } catch (error: any) {
        console.error('❌ Ошибка при подготовке загрузки:', error);
        reject(error);
      }
    });
  }

  /**
   * Получение изображения для страницы просмотра по UUID (публичный метод)
   */
  async getImageForViewPage(uuid: string): Promise<APIResponse<UploadedImage>> {
    try {
      console.log(`🔍 Получение изображения по UUID: ${uuid}`);
      
      // Используем fetchClient для запроса
      const response = await fetch(`/api/images/original/${uuid}`, {
        headers: {
          'Authorization': `Bearer ${userDataService.getToken()}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        const imageData: UploadedImage = {
          id: data.id || 0,
          fileUuid: data.fileUuid || uuid,
          fileName: data.filename || 'Изображение',
          originalUrl: data.originalUrl || '',
          thumbnailUrl: data.thumbnailUrl || data.originalUrl || '',
          comment: data.comment || '',
          fileSize: data.fileSize || 0,
          dimensions: data.dimensions || 
                     (data.width && data.height ? 
                      `${data.width}x${data.height}` : null),
          created_at: data.created_at || new Date().toISOString(),
          isFileOnDisk: true,
          storedFilename: data.storedFilename || data.filename || ''
        };
        
        return {
          success: true,
          data: imageData,
          status: response.status
        };
      }
      
      return {
        success: false,
        message: data.message || 'Изображение не найдено',
        status: response.status
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения изображения:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения изображения',
        status: 0
      };
    }
  }

  /**
   * Удаление изображения (публичный метод)
   */
  async deleteImage(id: number): Promise<APIResponse<{ message: string }>> {
    try {
      console.log(`🗑️ Удаление изображения ${id}...`);
      
      const response = await fetchClient.delete<{ message: string }>(`/data/${id}`);
      
      return {
        success: response.success,
        message: response.message || (response.success ? 'Изображение удалено' : 'Ошибка удаления'),
        status: response.status,
        field: response.field
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка удаления изображения:', error);
      return {
        success: false,
        message: error.message || 'Ошибка удаления изображения',
        status: 0
      };
    }
  }

  /**
   * Получение изображений с пагинацией (публичный метод для обратной совместимости)
   * Возвращает старую структуру { images: [...], pagination: {...} }
   */
  async getPaginatedImages(params?: {
    page?: number;
    limit?: number;
  }): Promise<APIResponse<{
    images: UploadedImage[];
    pagination: PaginationInfo;
  }>> {
    try {
      console.log(`📥 Получение изображений с пагинацией через getPaginated...`);
      
      // Используем базовый метод getPaginated
      const response = await this.getPaginated(params);
      
      if (response.success && response.data) {
        // Преобразуем items → images для обратной совместимости
        return {
          success: true,
          data: {
            images: response.data.items, // items → images
            pagination: response.data.pagination
          },
          status: response.status,
          responseTime: response.responseTime
        };
      }
      
      return {
        success: false,
        message: response.message || 'Ошибка получения изображений',
        status: response.status
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения изображений:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения изображений',
        status: 0
      };
    }
  }

  // ==================== УТИЛИТНЫЕ МЕТОДЫ ====================

  /**
   * Нормализует данные изображения (приватный метод)
   */
  private normalizeImageData(image: any): UploadedImage {
    // Используем готовую функцию normalizeImage из account.types.ts если она есть
    if (typeof normalizeImage === 'function') {
      return normalizeImage(image);
    }
    
    // Fallback если функция normalizeImage не экспортирована
    return {
      id: image.id || 0,
      fileUuid: image.fileUuid,
      fileName: image.fileName || '',
      comment: image.comment || '',
      smallImage: image.smallImage,
      originIMG: image.originIMG,
      imageUrl: image.imageUrl,
      thumbnailUrl: image.thumbnailUrl,
      originalUrl: image.originalUrl || image.originIMG,
      storedFilename: image.storedFilename,
      isFileOnDisk: image.isFileOnDisk,
      fileSize: image.fileSize,
      dimensions: image.dimensions,
      created_at: image.created_at
    };
  }

  /**
   * Формирование URL для доступа к файлу на сервере (публичный метод)
   */
  getImageUrl(image: UploadedImage): string {
    if (!image) {
      console.warn('❌ Нет данных изображения');
      return '';
    }
    
    if (image.originalUrl) {
      return image.originalUrl;
    }
    
    if (image.thumbnailUrl) {
      console.warn('⚠️ Нет originalUrl, используем thumbnailUrl');
      return image.thumbnailUrl;
    }
    
    console.error('❌ Ошибка: изображение не имеет URL', image);
    return '';
  }

  /**
   * Формирование URL для превью (публичный метод)
   */
  getThumbnailUrl(image: UploadedImage): string {
    if (!image) {
      console.warn('❌ Нет данных изображения для превью');
      return '';
    }
    
    if (image.thumbnailUrl) {
      return image.thumbnailUrl;
    }
    
    console.warn('⚠️ Нет thumbnailUrl, используем оригинал');
    return this.getImageUrl(image);
  }

  /**
   * Определение MIME типа по имени файла (публичный метод)
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
  }

  /**
   * Получение размера файла в читаемом формате (публичный метод)
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
  }

  /**
   * Скачивание изображения (публичный метод)
   */
  async downloadImage(image: UploadedImage): Promise<void> {
    try {
      if (!image || !image.originalUrl) {
        throw new Error('Нет данных изображения или URL для скачивания');
      }

      let downloadUrl = image.originalUrl;
      
      if (downloadUrl.startsWith('/')) {
        downloadUrl = window.location.origin + downloadUrl;
      }
          
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const fileName = image.fileName || 
                      (image.storedFilename ? 
                       image.storedFilename.split('/').pop() : 'image.jpg') || 
                      'image.jpg';
      
      link.download = fileName;
      link.setAttribute('download', fileName);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
    } catch (error) {
      console.error('❌ Ошибка при скачивании изображения:', error);
      throw error;
    }
  }
}

// Нужно импортировать fetchClient для метода deleteImage


// Экспортируем синглтон
export const imagesApi = new ImagesApi();

// Экспорт отдельных функций для обратной совместимости
export const uploadImage = imagesApi.uploadImage.bind(imagesApi);
export const deleteImage = imagesApi.deleteImage.bind(imagesApi);
export const getImageForViewPage = imagesApi.getImageForViewPage.bind(imagesApi);
export const getPaginatedImages = imagesApi.getPaginatedImages.bind(imagesApi);
export const getImageUrl = imagesApi.getImageUrl.bind(imagesApi);
export const getThumbnailUrl = imagesApi.getThumbnailUrl.bind(imagesApi);
export const getMimeType = imagesApi.getMimeType.bind(imagesApi);
export const getReadableFileSize = imagesApi.getReadableFileSize.bind(imagesApi);
export const downloadImage = imagesApi.downloadImage.bind(imagesApi);

export default imagesApi;