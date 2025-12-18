import { fetchClient } from './fetchClient';
import { APIResponse, UploadedImage } from '../components/AccountPage/types/account.types';

export const imagesApi = {
  /**
   * Получение изображений пользователя с поддержкой файловой системы
   */
  async getUserImages(): Promise<APIResponse & { data?: UploadedImage[] }> {
    try {
      console.log('📥 Запрос изображений пользователя...');
      
      const response = await fetchClient.post<{
        images: UploadedImage[];
      }>('/images', {});
      
      if (response.success && response.data) {
        console.log(`✅ Получено ${response.data.images?.length || 0} изображений`);
        
        // Логируем что пришло с сервера
        response.data.images.forEach((img: UploadedImage, idx: number) => {
          console.log(`📊 Изображение ${idx + 1} от сервера:`, {
            id: img.id,
            fileName: img.fileName,
            fileUuid: img.fileUuid,
            storedFilename: img.storedFilename,
            originalUrl: img.originalUrl,
            thumbnailUrl: img.thumbnailUrl,
            isFileOnDisk: img.isFileOnDisk
          });
        });
        
        // Возвращаем как есть - сервер должен сформировать правильные URL
        return {
          success: true,
          data: response.data.images,
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
      pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      }
    }
  }> {
    try {
      const response = await fetchClient.post<{
        images: UploadedImage[];
        pagination: any;
      }>('/images/paginated', params || {});
      
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
   * Получение информации об изображении по ID
   */
  async getImageInfoById(id: number): Promise<APIResponse & { 
    data?: { 
      filename: string, 
      fileUuid?: string,
      comment?: string,
      fileSize?: number,
      dimensions?: string,
      isFileOnDisk?: boolean
    } 
  }> {
    try {
      console.log(`🔍 Получение информации об изображении ID: ${id}`);
      
      const response = await fetchClient.get(`/images/${id}`);
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data,
        };
      }
      
      // Fallback: ищем в общем списке
      const imagesResponse = await imagesApi.getUserImages();
      if (imagesResponse.success && imagesResponse.data) {
        const image = imagesResponse.data.find((img: UploadedImage) => img.id === id);
        if (image) {
          return {
            success: true,
            data: {
              filename: image.fileName,
              fileUuid: image.fileUuid,
              comment: image.comment,
              fileSize: image.fileSize,
              dimensions: image.dimensions,
            },
          };
        }
      }
      
      return {
        success: false,
        message: 'Изображение не найдено',
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения информации об изображении:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения информации об изображении',
      };
    }
  },

  /**
   * Получение оригинального изображения по UUID
   */
  async getOriginalImageByUuid(uuid: string): Promise<APIResponse & {
    data?: {
      filename: string,
      originalUrl: string,
      thumbnailUrl: string,
      fileUuid?: string,
      fileSize?: number,
      dimensions?: string,
      comment?: string
    }
  }> {
    try {
      console.log(`🔍 Получение оригинального изображения UUID: ${uuid}`);
      
      const response = await fetchClient.get(`/images/original/${uuid}`);
      
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
      console.error('❌ Ошибка получения оригинального изображения:', error);
      return {
        success: false,
        message: error.message || 'Ошибка получения изображения',
      };
    }
  },

  /**
   * Получение изображения для страницы просмотра
   */
  async getImageForViewPage(id: number): Promise<APIResponse & {
    data?: UploadedImage
  }> {
    try {
      console.log(`🔍 Получение изображения для страницы ID: ${id}`);
      
      const imagesResponse = await imagesApi.getUserImages();
      
      if (!imagesResponse.success) {
        return imagesResponse;
      }
      
      if (!imagesResponse.data) {
        return {
          success: false,
          message: 'Нет данных изображений',
        };
      }
      
      const image = imagesResponse.data.find((img: UploadedImage) => img.id === id);
      
      if (!image) {
        return {
          success: false,
          message: `Изображение с ID ${id} не найдено`,
        };
      }
      
      return {
        success: true,
        data: image,
      };
      
    } catch (error: any) {
      console.error('❌ Ошибка получения изображения для страницы:', error);
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
    if (!image) {
      console.warn('⚠️ Нет данных изображения');
      return '';
    }

    console.log('🔍 getImageUrl для изображения:', {
      id: image.id,
      fileName: image.fileName,
      originalUrl: image.originalUrl,
      thumbnailUrl: image.thumbnailUrl,
      storedFilename: image.storedFilename,
      fileUuid: image.fileUuid
    });

    // ПРИОРИТЕТ 1: Если сервер отправил originalUrl
    if (image.originalUrl) {
      console.log('✅ Используем originalUrl от сервера');
      return imagesApi.makeFullUrl(image.originalUrl);
    }

    // ПРИОРИТЕТ 2: Если сервер отправил thumbnailUrl как fallback
    if (image.thumbnailUrl) {
      console.log('⚠️ Нет originalUrl, используем thumbnailUrl');
      return imagesApi.makeFullUrl(image.thumbnailUrl);
    }

    // ПРИОРИТЕТ 3: Если есть storedFilename (имя файла на диске от сервера)
    if (image.storedFilename) {
      const login = fetchClient.getCurrentLogin();
      if (login) {
        const url = `/uploads/${login}/originals/${image.storedFilename}`;
        console.log('⚠️ Нет URL от сервера, строим из storedFilename:', url);
        return imagesApi.makeFullUrl(url);
      }
    }

    // ПРИОРИТЕТ 4: Если есть только UUID и имя файла (запасной вариант)
    if (image.fileUuid && image.fileName) {
      const login = fetchClient.getCurrentLogin();
      if (login) {
        const extension = imagesApi.getFileExtension(image.fileName);
        const baseName = imagesApi.getBaseFileName(image.fileName);
        // Формируем имя: UUID_оригинальное_имя.расширение
        const filename = `${image.fileUuid}_${baseName}${extension}`;
        const url = `/uploads/${login}/originals/${filename}`;
        console.log('⚠️ Нет storedFilename, строим из UUID и имени:', url);
        return imagesApi.makeFullUrl(url);
      }
    }

    // ПРИОРИТЕТ 5: Base64 для обратной совместимости
    if (image.originIMG) {
      const mimeType = imagesApi.getMimeType(image.fileName);
      console.log('⚠️ Используем Base64 (обратная совместимость)');
      return `data:${mimeType};base64,${image.originIMG}`;
    }

    console.warn('❌ Не удалось создать URL для изображения');
    return '';
  },

  /**
   * Формирование URL для превью
   */
  getThumbnailUrl(image: UploadedImage): string {
    if (!image) {
      console.warn('⚠️ Нет данных изображения');
      return '';
    }

    console.log('🔍 getThumbnailUrl для изображения:', {
      id: image.id,
      fileName: image.fileName,
      thumbnailUrl: image.thumbnailUrl,
      storedFilename: image.storedFilename,
      fileUuid: image.fileUuid
    });

    // ПРИОРИТЕТ 1: Если сервер отправил thumbnailUrl
    if (image.thumbnailUrl) {
      console.log('✅ Используем thumbnailUrl от сервера');
      return imagesApi.makeFullUrl(image.thumbnailUrl);
    }

    // ПРИОРИТЕТ 2: Если есть storedFilename
    if (image.storedFilename) {
      const login = fetchClient.getCurrentLogin();
      if (login) {
        const url = `/uploads/${login}/thumbnails/${image.storedFilename}`;
        console.log('⚠️ Нет thumbnailUrl от сервера, строим из storedFilename:', url);
        return imagesApi.makeFullUrl(url);
      }
    }

    // ПРИОРИТЕТ 3: Если есть только UUID и имя файла
    if (image.fileUuid && image.fileName) {
      const login = fetchClient.getCurrentLogin();
      if (login) {
        const extension = imagesApi.getFileExtension(image.fileName);
        const baseName = imagesApi.getBaseFileName(image.fileName);
        const filename = `${image.fileUuid}_${baseName}${extension}`;
        const url = `/uploads/${login}/thumbnails/${filename}`;
        console.log('⚠️ Нет storedFilename, строим из UUID и имени:', url);
        return imagesApi.makeFullUrl(url);
      }
    }

    // ПРИОРИТЕТ 4: Base64 превью
    if (image.smallImage) {
      console.log('⚠️ Используем Base64 превью');
      return `data:image/jpeg;base64,${image.smallImage}`;
    }

    // ПРИОРИТЕТ 5: Основное изображение как fallback
    console.log('⚠️ Используем оригинальное изображение как превью');
    return imagesApi.getImageUrl(image);
  },

  /**
   * Преобразование относительного URL в полный
   */
  makeFullUrl(url: string): string {
    if (!url) return '';
    
    // Если URL уже полный или data URL
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    
    let baseURL = fetchClient.getBaseURL();
    if (baseURL.endsWith('/api')) {
      baseURL = baseURL.substring(0, baseURL.length - 4);
    }
    
    if (url.startsWith('/')) {
      // Проверяем, нужно ли добавлять base URL
      if (url.startsWith('/uploads/')) {
        // Для uploads URLs, проверяем если base URL уже есть
        const fullUrl = `${baseURL}${url}`;
        console.log('🔗 makeFullUrl:', { original: url, baseURL, fullUrl });
        return fullUrl;
      }
      return `${baseURL}${url}`;
    }
    
    return `${baseURL}/${url}`;
  },

  /**
   * Получение расширения файла из имени
   */
  getFileExtension(filename: string): string {
    if (!filename) return '.jpg';
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return '.jpg';
    return filename.substring(lastDotIndex).toLowerCase();
  },

  /**
   * Получение имени файла без расширения
   */
  getBaseFileName(filename: string): string {
    if (!filename) return 'image';
    const extension = imagesApi.getFileExtension(filename);
    const baseName = filename.substring(0, filename.length - extension.length);
    // Очищаем имя файла от недопустимых символов
    return baseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, '_');
  },

  /**
   * Определение MIME типа по имени файла
   */
  getMimeType(filename: string): string {
    const ext = imagesApi.getFileExtension(filename).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.bmp':
        return 'image/bmp';
      case '.tiff':
      case '.tif':
        return 'image/tiff';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  },

  /**
   * Проверка, использует ли изображение файловую систему
   */
  isUsingFileSystem(image: UploadedImage): boolean {
    return !!(image.originalUrl || image.thumbnailUrl || image.storedFilename || image.fileUuid || image.isFileOnDisk);
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
   * Проверка доступности изображения
   */
  async checkImageAvailability(image: UploadedImage): Promise<boolean> {
    try {
      const imageUrl = imagesApi.getImageUrl(image);
      if (!imageUrl) return false;
      
      if (imageUrl.startsWith('data:')) {
        return true;
      }
      
      const response = await fetch(imageUrl, { 
        method: 'HEAD',
        credentials: 'include'
      });
      
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Скачивание изображения
   */
  async downloadImage(image: UploadedImage): Promise<void> {
    try {
      const imageUrl = imagesApi.getImageUrl(image);
      if (!imageUrl) {
        throw new Error('Нет данных для скачивания изображения');
      }

      const fullUrl = imagesApi.makeFullUrl(imageUrl);
      const link = document.createElement("a");
      link.href = fullUrl;
      link.download = image.fileName || 'image.jpg';
      link.target = '_blank';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`✅ Изображение "${image.fileName}" скачивается`);
    } catch (error) {
      console.error('❌ Ошибка при скачивании изображения:', error);
      throw error;
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
export const getImageInfoById = imagesApi.getImageInfoById;
export const getPaginatedImages = imagesApi.getPaginatedImages;
export const getOriginalImageByUuid = imagesApi.getOriginalImageByUuid;
export const getImageForViewPage = imagesApi.getImageForViewPage;
export const getImageUrl = imagesApi.getImageUrl;
export const getThumbnailUrl = imagesApi.getThumbnailUrl;
export const getMimeType = imagesApi.getMimeType;
export const getReadableFileSize = imagesApi.getReadableFileSize;
export const isUsingFileSystem = imagesApi.isUsingFileSystem;
export const downloadImage = imagesApi.downloadImage;
export const makeFullUrl = imagesApi.makeFullUrl;
export const getFileExtension = imagesApi.getFileExtension;
export const getBaseFileName = imagesApi.getBaseFileName;

export default imagesApi;