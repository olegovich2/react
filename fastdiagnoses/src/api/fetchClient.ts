import { APIResponse } from '../types/api.types';

/**
 * Универсальный fetch клиент с полной типизацией
 * T - тип данных в ответе (data поле)
 */
class FetchClient {
  private baseURL: string;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  /**
   * Основной типизированный метод запроса
   * @template T - тип данных в ответе (по умолчанию any)
   * @param url - URL endpoint
   * @param options - опции fetch запроса
   * @returns Promise с типизированным ответом
   */
  async request<T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<APIResponse & { data?: T }> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    // Получаем токен как в вашем коде
    let token = '';
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        token = user.jwt_access;
      }
    } catch (e) {
      console.warn('Не удалось получить токен:', e);
    }

    // Создаем headers объект
    const headers: Record<string, string> = {};
    
    // Добавляем Content-Type если это не FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Добавляем Authorization header если есть токен
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Добавляем пользовательские headers если есть
    if (options.headers) {
      if (options.headers instanceof Headers) {
        // Если это Headers объект
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        // Если это массив пар [key, value]
        options.headers.forEach(([key, value]) => {
          if (typeof value === 'string') {
            headers[key] = value;
          }
        });
      } else {
        // Если это обычный объект
        Object.entries(options.headers).forEach(([key, value]) => {
          if (typeof value === 'string') {
            headers[key] = value;
          }
        });
      }
    }

    // Преобразуем body если нужно
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      body = JSON.stringify(body);
    }

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        body,
        credentials: 'include',
      });

      console.log(`Запрос ${url}: статус ${response.status}`);

      // 🔥 Обработка редиректов как в вашем коде
      if (response.redirected) {
        const redirectUrl = response.url;
        console.log(`Сервер сделал редирект на: ${redirectUrl}`);

        // Обработка редиректов на страницы входа
        if (redirectUrl.includes('/main/entry') || redirectUrl.includes('/login')) {
          // Очищаем localStorage КАК В ВАШЕМ КОДЕ
          this.clearLocalStorage();
          
          // Редирект в браузере
          setTimeout(() => {
            window.location.href = redirectUrl.includes('http') 
              ? redirectUrl 
              : `${window.location.origin}${redirectUrl}`;
          }, 100);
          
          return {
            success: false,
            message: 'Redirected to login',
            redirected: true,
            redirectUrl: redirectUrl
          };
        }

        // Для других редиректов
        window.location.href = redirectUrl;
        return {
          success: false,
          message: 'Redirected',
          redirected: true,
          redirectUrl: redirectUrl
        };
      }

      // Проверка статуса (как в вашем if (response.ok))
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ошибка ${url}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Обработка разных типов ответов
      const contentType = response.headers.get('content-type');
      let responseData: any;

      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        // Ваш сервер иногда возвращает текст/HTML
        responseData = await response.text();
        
        // Если это HTML страница, обрабатываем особо
        if (responseData.includes('<!DOCTYPE html>') || responseData.includes('<html')) {
          console.warn('Сервер вернул HTML вместо JSON для', url);
          
          // Для некоторых endpoints это нормально
          if (url.includes('/main/auth/variants')) {
            // Проверяем наличие ошибок в HTML
            if (responseData.includes('errorMessage')) {
              const errorMatch = responseData.match(/errorMessage=([^&"]+)/);
              if (errorMatch) {
                throw new Error(decodeURIComponent(errorMatch[1]));
              }
            }
            
            // Если нет ошибок, считаем успехом
            return {
              success: true,
              data: { message: 'Registration successful' } as T,
              redirected: false
            };
          }
        }
      }

      return {
        success: true,
        data: responseData as T,
        redirected: false
      };

    } catch (error: any) {
      console.error('Fetch error for', url, ':', error);

      // Обработка специфических ошибок
      if (error.message.includes('Failed to fetch')) {
        return {
          success: false,
          message: 'Ошибка соединения с сервером. Проверьте подключение.'
        };
      }

      if (error.message.includes('401')) {
        this.clearLocalStorage();
        window.location.href = '/login';
      }

      return {
        success: false,
        message: error.message || 'Неизвестная ошибка'
      };
    }
  }

  /**
   * POST запрос с типизацией
   * @template T - тип данных в ответе
   */
  async post<T = any>(url: string, data?: any): Promise<APIResponse & { data?: T }> {
    return this.request<T>(url, {
      method: 'POST',
      body: data,
    });
  }

  /**
   * GET запрос с типизацией
   * @template T - тип данных в ответе
   */
  async get<T = any>(url: string): Promise<APIResponse & { data?: T }> {
    return this.request<T>(url, { method: 'GET' });
  }

  /**
   * PUT запрос с типизацией
   * @template T - тип данных в ответе
   */
  async put<T = any>(url: string, data?: any): Promise<APIResponse & { data?: T }> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data,
    });
  }

  /**
   * DELETE запрос с типизацией
   * @template T - тип данных в ответе
   */
  async delete<T = any>(url: string, data?: any): Promise<APIResponse & { data?: T }> {
    return this.request<T>(url, {
      method: 'DELETE',
      body: data,
    });
  }

  /**
   * POST с FormData и типизацией
   * @template T - тип данных в ответе
   */
  async postFormData<T = any>(
    url: string, 
    formData: FormData
  ): Promise<APIResponse & { data?: T }> {
    // Создаем headers отдельно для FormData
    const headers: Record<string, string> = {};
    
    // Для FormData НЕ добавляем Content-Type, браузер сам установит
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<T>(url, {
      method: 'POST',
      body: formData,
      headers,
    });
  }

  /**
   * Специальный метод для загрузки файлов через FormData
   * @template T - тип данных в ответе
   */
  async uploadFile<T = any>(
    url: string,
    file: File,
    fieldName: string = 'file',
    additionalData: Record<string, any> = {}
  ): Promise<APIResponse & { data?: T }> {
    const formData = new FormData();
    formData.append(fieldName, file);
    
    // Добавляем дополнительные данные
    Object.entries(additionalData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    
    return this.postFormData<T>(url, formData);
  }

  /**
   * Очистка localStorage как в вашем коде
   */
  private clearLocalStorage(): void {
    const itemsToRemove = [
      'user',
      'token',
      'allSurveys',
      'originImage',
      'survey',
      'tempUploadData'
    ];
    
    itemsToRemove.forEach(item => {
      localStorage.removeItem(item);
    });
    
    console.log('LocalStorage очищен (как в вашем коде)');
  }

  /**
   * Установка базового URL
   */
  setBaseURL(url: string): void {
    this.baseURL = url;
  }

  /**
   * Получение текущего базового URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }
}

// Создаем и экспортируем синглтон экземпляр
const API_URL = process.env.REACT_APP_API_URL || '';
export const fetchClient = new FetchClient(API_URL);

// Также экспортируем класс для возможности создания новых инстансов
export { FetchClient };
export default fetchClient;