import axios, { AxiosResponse, AxiosError } from 'axios';
import { AdminApiResponse } from '../types';

// Конфигурация API
const API_CONFIG = {
  baseURL: '/api/admin',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Создаем экземпляр axios
const adminApi = axios.create(API_CONFIG);

// Интерцептор для добавления токена
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Интерцептор для обработки ответов (добавлен для логирования)
adminApi.interceptors.response.use(
  (response) => {
    console.log('📡 API Response:', {
      url: response.config.url,
      method: response.config.method,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error: AxiosError) => {
    console.error('📡 API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// Функция для обработки успешных ответов
const handleResponse = <T>(response: AxiosResponse<AdminApiResponse<T>>): AdminApiResponse<T> => {
  const data = response.data;
  
  console.log('🔍 handleResponse получил:', {
    success: data?.success,
    hasToken: !!(data as any)?.token,
    dataKeys: Object.keys(data || {})
  });
  
  // Проверяем структуру ответа
  if (data && data.success === false) {
    const errorMessage = (data as any)?.message || 'Запрос завершился с ошибкой';
    console.warn('⚠️ API вернул success: false', errorMessage);
    throw new Error(errorMessage);
  }
  
  return data;
};

// Функция для обработки ошибок
const handleApiError = (error: any): never => {
  console.error('🔥 handleApiError:', error);
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<AdminApiResponse>;
    
    if (axiosError.response) {
      const { status, data } = axiosError.response;
      const errorData = data as AdminApiResponse;
      
      console.error('🔴 Ошибка API:', {
        status,
        message: errorData?.message,
        data: errorData
      });
      
      switch (status) {
        case 401:
          console.warn('🚪 401 Unauthorized - очищаю токен');
          localStorage.removeItem('admin_token');
          // Не перенаправляем автоматически - пусть компонент решает
          break;
        case 403:
          console.error('⛔ 403 Forbidden - недостаточно прав');
          break;
        case 404:
          console.error('🔍 404 Not Found - ресурс не найден');
          break;
        case 500:
          console.error('💥 500 Internal Server Error');
          break;
      }
      
      // Бросаем ошибку с информацией из API
      throw new Error(errorData?.message || `Ошибка ${status}: ${axiosError.message}`);
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Таймаут запроса. Проверьте соединение с интернетом.');
    }
    
    if (!error.response) {
      throw new Error('Ошибка сети. Проверьте подключение к интернету.');
    }
  }
  
  // Если это обычная ошибка (не AxiosError)
  throw error instanceof Error ? error : new Error(String(error));
};

// Обертка для запросов
const apiRequest = async <T>(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any,
  params?: any
): Promise<AdminApiResponse<T>> => {
  console.log('🚀 apiRequest:', { method, url, data: data ? '***' : undefined, params });
  
  try {
    let response: AxiosResponse<AdminApiResponse<T>>;
    
    switch (method) {
      case 'get':
        response = await adminApi.get(url, { params });
        break;
      case 'post':
        response = await adminApi.post(url, data, { params });
        break;
      case 'put':
        response = await adminApi.put(url, data, { params });
        break;
      case 'delete':
        response = await adminApi.delete(url, { params });
        break;
      default:
        throw new Error(`Неизвестный метод: ${method}`);
    }
    
    return handleResponse(response);
  } catch (error) {
    return handleApiError(error);
  }
};

// API методы для авторизации
export const authService = {
  login: async (username: string, password: string): Promise<AdminApiResponse> => {
    console.log('🔐 Начало authService.login для пользователя:', username);
    
    try {
      const response = await apiRequest<{ 
        token?: string; 
        admin?: any;
      }>('post', '/auth/login', { username, password });
      
      // console.log('✅ authService.login - ответ от сервера:', {
      //   success: response.success,
      //   hasToken: !!response.token,
      //   tokenPreview: response.token ? 
      //     `${response.token.substring(0, 20)}...${response.token.substring(response.token.length - 10)}` : 
      //     'Нет токена',
      //   admin: response.admin ? 'Есть данные админа' : 'Нет данных админа'
      // });
      
      if (response.success && response.token) {
        console.log('💾 Сохраняю токен в localStorage');
        localStorage.setItem('admin_token', response.token);
        
        // Проверяем, что токен сохранился
        const savedToken = localStorage.getItem('admin_token');
        console.log('✅ Токен сохранен?', !!savedToken);
        console.log('📏 Длина токена:', savedToken?.length);
      } else {
        console.warn('⚠️ Токен не получен при логине:', response);
      }
      
      return response;
    } catch (error: any) {
      console.error('❌ Ошибка в authService.login:', error.message);
      // Пробрасываем ошибку для обработки в компоненте
      throw error;
    }
  },
  
  logout: async (): Promise<AdminApiResponse> => {
    console.log('🚪 Начало authService.logout');
    
    try {
      const response = await apiRequest('post', '/auth/logout');
      console.log('✅ authService.logout - успех');
      return response;
    } catch (error: any) {
      console.error('❌ Ошибка в authService.logout:', error.message);
      // Даже если сервер вернул ошибку, очищаем локально
      throw error;
    } finally {
      console.log('🧹 Очищаю токен из localStorage');
      localStorage.removeItem('admin_token');
    }
  },
  
  verify: async (): Promise<AdminApiResponse> => {
    console.log('🔍 Проверка токена');
    
    try {
      const token = localStorage.getItem('admin_token');
      console.log('📝 Токен в localStorage:', token ? 'Есть' : 'Нет');
      
      if (!token) {
        throw new Error('Токен не найден в localStorage');
      }
      
      const response = await apiRequest('get', '/auth/verify');
      console.log('✅ verify - токен валиден');
      return response;
    } catch (error: any) {
      console.error('❌ Ошибка в verify:', error.message);
      // Очищаем невалидный токен
      localStorage.removeItem('admin_token');
      throw error;
    }
  },
  
  getProfile: async (): Promise<AdminApiResponse> => {
    console.log('👤 Запрос профиля админа');
    return await apiRequest('get', '/auth/profile');
  },
  
  // Вспомогательный метод для проверки токена
  checkAuth: async (): Promise<boolean> => {
    try {
      await authService.verify();
      return true;
    } catch {
      return false;
    }
  }
};

// API методы для пользователей
export const usersService = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/users', undefined, params);
  },
  
  getById: async (id: number): Promise<AdminApiResponse> => {
    return await apiRequest('get', `/users/${id}`);
  },
  
  update: async (id: number, data: Partial<any>): Promise<AdminApiResponse> => {
    return await apiRequest('put', `/users/${id}`, data);
  },
  
  delete: async (id: number): Promise<AdminApiResponse> => {
    return await apiRequest('delete', `/users/${id}`);
  },
  
  block: async (id: number): Promise<AdminApiResponse> => {
    return await apiRequest('post', `/users/${id}/block`);
  },
  
  unblock: async (id: number): Promise<AdminApiResponse> => {
    return await apiRequest('post', `/users/${id}/unblock`);
  },
  
  resetPassword: async (id: number): Promise<AdminApiResponse> => {
    return await apiRequest('post', `/users/${id}/reset-password`);
  },
};

// API методы для дашборда
export const dashboardService = {
  getStats: async (): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/dashboard/stats');
  },
  
  getActivity: async (limit: number = 10): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/dashboard/activity', undefined, { limit });
  },
  
  getSystemHealth: async (): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/dashboard/health');
  },
};

// API методы для логов
export const logsService = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    level?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/logs', undefined, params);
  },
  
  getErrorLogs: async (params?: { page?: number; limit?: number }): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/logs/errors', undefined, params);
  },
  
  clearOldLogs: async (days: number = 30): Promise<AdminApiResponse> => {
    return await apiRequest('delete', '/logs/old', undefined, { days });
  },
};

// API методы для настроек
export const settingsService = {
  getSettings: async (): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/settings');
  },
  
  updateSettings: async (settings: any): Promise<AdminApiResponse> => {
    return await apiRequest('put', '/settings', settings);
  },
  
  getEmailRequests: async (): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/email-requests');
  },
  
  processEmailRequest: async (requestId: number, action: 'approve' | 'reject'): Promise<AdminApiResponse> => {
    return await apiRequest('post', `/email-requests/${requestId}/${action}`);
  },
  
  getBackups: async (): Promise<AdminApiResponse> => {
    return await apiRequest('get', '/backups');
  },
  
  createBackup: async (): Promise<AdminApiResponse> => {
    return await apiRequest('post', '/backups/create');
  },
  
  restoreBackup: async (backupId: number): Promise<AdminApiResponse> => {
    return await apiRequest('post', `/backups/${backupId}/restore`);
  },
};

// Экспортируем базовый инстанс для кастомных запросов
export default adminApi;

// Вспомогательные утилиты
export const adminApiUtils = {
  // Получить текущий токен
  getToken: (): string | null => {
    return localStorage.getItem('admin_token');
  },
  
  // Проверить, авторизован ли пользователь
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('admin_token');
  },
  
  // Очистить авторизацию
  clearAuth: (): void => {
    localStorage.removeItem('admin_token');
    console.log('🧹 Авторизация очищена');
  },
  
  // Установить токен (например, для тестирования)
  setToken: (token: string): void => {
    localStorage.setItem('admin_token', token);
    console.log('✅ Токен установлен вручную');
  }
};