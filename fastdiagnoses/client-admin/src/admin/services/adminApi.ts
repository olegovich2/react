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
    console.log('🔑 [adminApi] Добавляем токен в заголовок:', token ? 'Есть' : 'Нет');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 [adminApi] Токен добавлен:', token.substring(0, 20) + '...');
    }
    return config;
  },
  (error) => {
    console.error('❌ [adminApi] Ошибка в интерцепторе запроса:', error);
    return Promise.reject(error);
  }
);

// Интерцептор для обработки ответов
adminApi.interceptors.response.use(
  (response) => {
    console.log('📡 [adminApi] Ответ получен:', {
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      status: response.status,
      dataKeys: Object.keys(response.data || {})
    });
    
    // Детальный лог для auth/login
    if (response.config.url?.includes('/auth/login')) {
      console.log('🔐 [adminApi] Детали логина:', {
        success: response.data?.success,
        hasToken: !!response.data?.token,
        hasAdmin: !!response.data?.admin,
        adminData: response.data?.admin,
        message: response.data?.message
      });
    }
    
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ [adminApi] Ошибка API:', {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// Функция для обработки успешных ответов
const handleResponse = <T>(response: AxiosResponse<AdminApiResponse<T>>): AdminApiResponse<T> => {
  const data = response.data;
  
  console.log('🔍 [adminApi] handleResponse:', {
    success: data?.success,
    hasToken: !!data?.token,
    hasAdmin: !!data?.admin,
    hasData: !!data?.data,
    message: data?.message,
    allKeys: Object.keys(data || {})
  });
  
  // Проверяем структуру ответа
  if (data && data.success === false) {
    const errorMessage = data?.message || 'Запрос завершился с ошибкой';
    console.warn('⚠️ [adminApi] API вернул success: false', errorMessage);
    throw new Error(errorMessage);
  }
  
  return data;
};

// Функция для обработки ошибок
const handleApiError = (error: any): never => {
  console.error('🔥 [adminApi] handleApiError:', {
    isAxiosError: axios.isAxiosError(error),
    message: error.message,
    code: error.code,
    responseStatus: error.response?.status,
    responseData: error.response?.data
  });
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<AdminApiResponse>;
    
    if (axiosError.response) {
      const { status, data } = axiosError.response;
      const errorData = data as AdminApiResponse;
      
      console.error('🔴 [adminApi] Ошибка API детали:', {
        status,
        message: errorData?.message,
        serverError: errorData?.error
      });
      
      switch (status) {
        case 401:
          console.warn('🚪 [adminApi] 401 Unauthorized - токен недействителен');
          localStorage.removeItem('admin_token');
          break;
        case 403:
          console.error('⛔ [adminApi] 403 Forbidden - недостаточно прав');
          break;
        case 404:
          console.error('🔍 [adminApi] 404 Not Found - ресурс не найден');
          break;
        case 500:
          console.error('💥 [adminApi] 500 Internal Server Error');
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
  console.log('🚀 [adminApi] apiRequest:', { 
    method, 
    url, 
    hasData: !!data,
    hasParams: !!params 
  });
  
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
    console.log('🔐 [authService] login начало для пользователя:', username);
    
    try {
      const response = await apiRequest<{ 
        token?: string; 
        admin?: any;
      }>('post', '/auth/login', { username, password });
      
      console.log('✅ [authService] login успех:', {
        success: response.success,
        hasToken: !!response.token,
        hasAdmin: !!response.admin,
        adminUsername: response.admin?.username,
        adminRole: response.admin?.role
      });
      
      if (response.success && response.token) {
        console.log('💾 [authService] Сохраняю токен в localStorage');
        localStorage.setItem('admin_token', response.token);
        
        // Проверяем, что токен сохранился
        const savedToken = localStorage.getItem('admin_token');
        console.log('✅ [authService] Токен сохранен?', !!savedToken);
        console.log('📏 [authService] Длина токена:', savedToken?.length);
      } else {
        console.warn('⚠️ [authService] Токен не получен при логине:', response.message);
      }
      
      return response;
    } catch (error: any) {
      console.error('❌ [authService] Ошибка в login:', error.message);
      throw error;
    }
  },
  
  logout: async (): Promise<AdminApiResponse> => {
    console.log('🚪 [authService] logout начало');
    
    try {
      const response = await apiRequest('post', '/auth/logout');
      console.log('✅ [authService] logout успех');
      return response;
    } catch (error: any) {
      console.error('❌ [authService] Ошибка в logout:', error.message);
      // Даже если сервер вернул ошибку, очищаем локально
      throw error;
    } finally {
      console.log('🧹 [authService] Очищаю токен из localStorage');
      localStorage.removeItem('admin_token');
    }
  },
  
  verify: async (): Promise<AdminApiResponse> => {
    console.log('🔍 [authService] verify начало');
    
    try {
      const token = localStorage.getItem('admin_token');
      console.log('📝 [authService] Токен в localStorage:', token ? 'Есть' : 'Нет');
      console.log('📏 [authService] Длина токена:', token?.length);
      
      if (!token) {
        throw new Error('Токен не найден в localStorage');
      }
      
      const response = await apiRequest('post', '/auth/verify');
      console.log('✅ [authService] verify успех:', {
        success: response.success,
        hasAdmin: !!response.admin,
        adminUsername: response.admin?.username
      });
      return response;
    } catch (error: any) {
      console.error('❌ [authService] Ошибка в verify:', error.message);
      // Очищаем невалидный токен
      localStorage.removeItem('admin_token');
      throw error;
    }
  },
  
  getProfile: async (): Promise<AdminApiResponse> => {
    console.log('👤 [authService] Запрос профиля админа');
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
    console.log('📊 [dashboardService] getStats начало');
    try {
      const response = await apiRequest('get', '/dashboard/stats');
      console.log('✅ [dashboardService] getStats успех:', {
        success: response.success,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });
      return response;
    } catch (error) {
      console.error('❌ [dashboardService] Ошибка в getStats:', error);
      throw error;
    }
  },
  
  getActivity: async (limit: number = 10): Promise<AdminApiResponse> => {
    console.log('📋 [dashboardService] getActivity начало');
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
    const token = localStorage.getItem('admin_token');
    console.log('🔑 [adminApiUtils] getToken:', token ? 'Есть' : 'Нет');
    return token;
  },
  
  // Проверить, авторизован ли пользователь
  isAuthenticated: (): boolean => {
    const isAuth = !!localStorage.getItem('admin_token');
    console.log('🔐 [adminApiUtils] isAuthenticated:', isAuth);
    return isAuth;
  },
  
  // Очистить авторизацию
  clearAuth: (): void => {
    console.log('🧹 [adminApiUtils] clearAuth');
    localStorage.removeItem('admin_token');
  },
  
  // Установить токен (например, для тестирования)
  setToken: (token: string): void => {
    console.log('💾 [adminApiUtils] setToken, длина:', token.length);
    localStorage.setItem('admin_token', token);
  }
};