import axios, { AxiosResponse, AxiosError } from 'axios';
import { 
  AdminApiResponse,
  BlockUserRequest,
  BlockUserResponse,
  UnblockUserResponse,
  UsersResponse,
  UserDetailsResponse,
  UsersFilterParams,
  User,
  DashboardStats,
  SupportRequest,
  ValidationResult,
  ProcessResult,
  SupportRequestsResponse,
  SupportRequestInfoResponse,
  ValidationResponse
} from '../types';

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
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор для обработки ответов
adminApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Функция для обработки успешных ответов
const handleResponse = <T extends AdminApiResponse>(response: AxiosResponse<T>): T => {
  const data = response.data;
  
  // Проверяем структуру ответа
  if (data && data.success === false) {
    const errorMessage = data?.message || 'Запрос завершился с ошибкой';
    throw new Error(errorMessage);
  }
  
  return data;
};

// Функция для обработки ошибок
const handleApiError = (error: any): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<AdminApiResponse>;
    
    if (axiosError.response) {
      const { status, data } = axiosError.response;
      
      switch (status) {
        case 401:
          localStorage.removeItem('admin_token');
          break;
      }
      
      // Бросаем ошибку с информацией из API
      throw new Error(data?.message || `Ошибка ${status}: ${axiosError.message}`);
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
const apiRequest = async <T extends AdminApiResponse>(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any,
  params?: any
): Promise<T> => {
  try {
    let response: AxiosResponse<T>;
    
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
    try {
      const response = await apiRequest<AdminApiResponse>('post', '/auth/login', { username, password });
      
      if (response.success && response.token) {
        localStorage.setItem('admin_token', response.token);
      }
      
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  logout: async (): Promise<AdminApiResponse> => {
    try {
      const response = await apiRequest<AdminApiResponse>('post', '/auth/logout');
      return response;
    } catch (error: any) {
      throw error;
    } finally {
      localStorage.removeItem('admin_token');
    }
  },
  
  verify: async (): Promise<AdminApiResponse> => {
    try {
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        throw new Error('Токен не найден в localStorage');
      }
      
      const response = await apiRequest<AdminApiResponse>('post', '/auth/verify');
      return response;
    } catch (error: any) {
      localStorage.removeItem('admin_token');
      throw error;
    }
  },
  
  getProfile: async (): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('get', '/auth/profile');
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
  // Получение списка пользователей
  getAll: async (params?: UsersFilterParams): Promise<UsersResponse> => {
    try {
      const response = await apiRequest<UsersResponse>('get', '/users', undefined, params);
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Получение детальной информации о пользователе (по логину)
  getUserDetails: async (login: string): Promise<UserDetailsResponse> => {
    try {
      const response = await apiRequest<UserDetailsResponse>('get', `/users/${login}`);
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Блокировка пользователя
  blockUser: async (
    login: string, 
    duration: '7d' | '30d' | 'forever', 
    reason?: string, 
    deleteSessions: boolean = false
  ): Promise<BlockUserResponse> => {
    try {
      const requestData: BlockUserRequest = { 
        duration, 
        reason, 
        deleteSessions 
      };
      
      const response = await apiRequest<BlockUserResponse>(
        'post', 
        `/users/${login}/block`, 
        requestData
      );
      
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Разблокировка пользователя
  unblockUser: async (login: string): Promise<UnblockUserResponse> => {
    try {
      const response = await apiRequest<UnblockUserResponse>(
        'post', 
        `/users/${login}/unblock`
      );
      
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Сброс пароля пользователя
  resetPassword: async (login: string): Promise<AdminApiResponse> => {
    try {
      const response = await apiRequest<AdminApiResponse>('post', `/users/${login}/reset-password`);
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Удаление пользователя
  deleteUser: async (login: string): Promise<AdminApiResponse> => {
    try {
      const response = await apiRequest<AdminApiResponse>('delete', `/users/${login}`);
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Получение только заблокированных пользователей (удобная обертка)
  getBlockedUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<UsersResponse> => {
    try {
      const filterParams: UsersFilterParams = {
        ...params,
        isBlocked: 'true'
      };
      
      const response = await apiRequest<UsersResponse>('get', '/users', undefined, filterParams);
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Получить активные запросы пользователя
  getUserSupportRequests: async (login: string): Promise<SupportRequest[]> => {
    try {
      const response = await apiRequest<AdminApiResponse & { data?: SupportRequest[] }>('get', `/users/${login}/support-requests`);
      return response.data || [];
    } catch (error: any) {
      throw error;
    }
  },
  
  // Получить детали конкретного запроса (с расшифрованными данными)
  getSupportRequestDetails: async (requestId: string): Promise<SupportRequest> => {
    try {
      const response = await apiRequest<AdminApiResponse & { data?: SupportRequest }>('get', `/support-requests/${requestId}`);
      
      if (!response.data) {
        throw new Error('Данные запроса не найдены');
      }
      
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Валидировать запрос (проверить кодовое слово, пароль и т.д.)
  validateSupportRequest: async (requestId: string): Promise<ValidationResult> => {
    try {
      const response = await apiRequest<ValidationResult>('post', `/support-requests/${requestId}/validate`);
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  processSupportRequest: async (
    requestId: string, 
    action: 'approve' | 'reject',
    data?: { 
      reason?: string; 
      emailResponse?: string;
    }
  ): Promise<ProcessResult> => {
    try {
      const response = await apiRequest<ProcessResult>(
        'post', 
        `/support/requests/${requestId}/process`, 
        { action, ...data }
      );
      
      return response;
    } catch (error: any) {
      throw error;
    }
  }
};

// API методы для дашборда
export const dashboardService = {
  getStats: async (): Promise<AdminApiResponse & { data?: DashboardStats }> => {
    try {
      const response = await apiRequest<AdminApiResponse & { data?: DashboardStats }>('get', '/dashboard/stats');
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  getActivity: async (limit: number = 10): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('get', '/dashboard/activity', undefined, { limit });
  },
  
  getServicesStatus: async (): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('get', '/dashboard/services');
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
    return await apiRequest<AdminApiResponse>('get', '/logs', undefined, params);
  },
  
  getErrorLogs: async (params?: { page?: number; limit?: number }): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('get', '/logs/errors', undefined, params);
  },
  
  clearOldLogs: async (days: number = 30): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('delete', '/logs/old', undefined, { days });
  },
};

// API методы для настроек
export const settingsService = {
  getSettings: async (): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('get', '/settings');
  },
  
  updateSettings: async (settings: any): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('put', '/settings', settings);
  },
  
  getEmailRequests: async (): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('get', '/email-requests');
  },
  
  processEmailRequest: async (requestId: number, action: 'approve' | 'reject'): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('post', `/email-requests/${requestId}/${action}`);
  },
  
  getBackups: async (): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('get', '/backups');
  },
  
  createBackup: async (): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('post', '/backups/create');
  },
  
  restoreBackup: async (backupId: number): Promise<AdminApiResponse> => {
    return await apiRequest<AdminApiResponse>('post', `/backups/${backupId}/restore`);
  },
};

// ==================== API ДЛЯ ТЕХПОДДЕРЖКИ (АДМИНСКИЕ) ====================

export const supportService = {
  // Получить запросы пользователя
  getUserSupportRequests: async (
    login: string, 
    type: string = 'all', 
    status: string = 'all'
  ): Promise<SupportRequestsResponse> => {
    try {
      const response = await apiRequest<SupportRequestsResponse>(
        'get', 
        `/support/user/${login}/requests`, 
        undefined, 
        { type, status }
      );
      
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // Получить информацию о конкретном запросе
  getSupportRequestInfo: async (requestId: string): Promise<SupportRequestInfoResponse> => {
    try {
      const response = await apiRequest<SupportRequestInfoResponse>(
        'get', 
        `/support/requests/${requestId}`
      );
      
      return response;
    } catch (error: any) {
      throw error;
    }
  },
  
  // АВТОМАТИЧЕСКАЯ проверка запроса (расшифровка + сравнение)
  validateSupportRequest: async (requestId: string): Promise<ValidationResponse> => {
    try {
      const response = await apiRequest<ValidationResponse>(
        'post', 
        `/support/requests/${requestId}/validate`
      );
      
      return response;
    } catch (error: any) {
      throw error;
    }
  }
};

// Экспортируем обновленный объект
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
  },
  
  // Установить токен (например, для тестирования)
  setToken: (token: string): void => {
    localStorage.setItem('admin_token', token);
  }
};