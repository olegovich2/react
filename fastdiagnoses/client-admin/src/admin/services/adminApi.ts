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
      hasData: !!response.data,
      dataKeys: Object.keys(response.data || {})
    });
    
    // Детальный лог для auth/login
    if (response.config.url?.includes('/auth/login')) {
      console.log('🔐 [adminApi] Детали логина:', {
        success: response.data?.success,
        hasToken: !!response.data?.token,
        hasAdmin: !!response.data?.admin,
        adminUsername: response.data?.admin?.username,
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
const handleResponse = <T extends AdminApiResponse>(response: AxiosResponse<T>): T => {
  const data = response.data;
  
  console.log('🔍 [adminApi] handleResponse:', {
    success: data?.success,
    hasToken: !!data?.token,
    hasAdmin: !!data?.admin,
    message: data?.message,
    // Для отладки - логируем все ключи
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
      
      console.error('🔴 [adminApi] Ошибка API детали:', {
        status,
        message: data?.message,
        serverError: data?.error
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
  console.log('🚀 [adminApi] apiRequest:', { 
    method, 
    url, 
    hasData: !!data,
    hasParams: !!params 
  });
  
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
    console.log('🔐 [authService] login начало для пользователя:', username);
    
    try {
      const response = await apiRequest<AdminApiResponse>('post', '/auth/login', { username, password });
      
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
      const response = await apiRequest<AdminApiResponse>('post', '/auth/logout');
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
      
      const response = await apiRequest<AdminApiResponse>('post', '/auth/verify');
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
    console.log('👥 [usersService] getAll запрос:', params);
    
    try {
      const response = await apiRequest<UsersResponse>('get', '/users', undefined, params);
      
      console.log('✅ [usersService] getAll ответ:', {
        success: response.success,
        usersCount: response.users?.length || 0,
        blockedCount: response.users?.filter((u: User) => u.isBlocked).length || 0,
        totalUsers: response.stats?.totalUsers,
        blockedUsers: response.stats?.blockedUsers,
        usersWithRequests: response.stats?.usersWithRequests,
        usersWithOverdueRequests: response.stats?.usersWithOverdueRequests,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [usersService] getAll ошибка:', error);
      throw error;
    }
  },
  
  // Получение детальной информации о пользователе (по логину)
  getUserDetails: async (login: string): Promise<UserDetailsResponse> => {
    console.log('👤 [usersService] getUserDetails запрос для:', login);
    
    try {
      const response = await apiRequest<UserDetailsResponse>('get', `/users/${login}`);
      
      console.log('✅ [usersService] getUserDetails ответ:', {
        success: response.success,
        hasUser: !!response.user,
        isBlocked: response.user?.isBlocked,
        blockStatus: response.user?.blockStatus,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [usersService] getUserDetails ошибка:', error);
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
    console.log('🔒 [usersService] blockUser запрос:', { 
      login, 
      duration, 
      reason, 
      deleteSessions 
    });
    
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
      
      console.log('✅ [usersService] blockUser ответ:', {
        success: response.success,
        message: response.message,
        login: response.login,
        blocked_until: response.blocked_until,
        sessions_deleted_count: response.sessions_deleted_count,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [usersService] blockUser ошибка:', error);
      throw error;
    }
  },
  
  // Разблокировка пользователя
  unblockUser: async (login: string): Promise<UnblockUserResponse> => {
    console.log('🔓 [usersService] unblockUser запрос:', { login });
    
    try {
      const response = await apiRequest<UnblockUserResponse>(
        'post', 
        `/users/${login}/unblock`
      );
      
      console.log('✅ [usersService] unblockUser ответ:', {
        success: response.success,
        message: response.message,
        login: response.login,
        previously_blocked: response.previously_blocked,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [usersService] unblockUser ошибка:', error);
      throw error;
    }
  },
  
  // Сброс пароля пользователя
  resetPassword: async (login: string): Promise<AdminApiResponse> => {
    console.log('🔑 [usersService] resetPassword запрос для:', login);
    
    try {
      const response = await apiRequest<AdminApiResponse>('post', `/users/${login}/reset-password`);
      
      console.log('✅ [usersService] resetPassword ответ:', {
        success: response.success,
        message: response.message,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [usersService] resetPassword ошибка:', error);
      throw error;
    }
  },
  
  // Удаление пользователя
  deleteUser: async (login: string): Promise<AdminApiResponse> => {
    console.log('🗑️ [usersService] deleteUser запрос для:', login);
    
    try {
      const response = await apiRequest<AdminApiResponse>('delete', `/users/${login}`);
      
      console.log('✅ [usersService] deleteUser ответ:', {
        success: response.success,
        message: response.message,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [usersService] deleteUser ошибка:', error);
      throw error;
    }
  },
  
  // Получение только заблокированных пользователей (удобная обертка)
  getBlockedUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<UsersResponse> => {
    console.log('👥 [usersService] getBlockedUsers запрос:', params);
    
    try {
      const filterParams: UsersFilterParams = {
        ...params,
        isBlocked: 'true'
      };
      
      const response = await apiRequest<UsersResponse>('get', '/users', undefined, filterParams);
      
      console.log('✅ [usersService] getBlockedUsers ответ:', {
        success: response.success,
        blockedUsersCount: response.users?.length || 0,
        stats: response.stats,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [usersService] getBlockedUsers ошибка:', error);
      throw error;
    }
  },
  
  // Получить активные запросы пользователя
  getUserSupportRequests: async (login: string): Promise<SupportRequest[]> => {
    console.log('📩 [usersService] getUserSupportRequests запрос для:', login);
    
    try {
      const response = await apiRequest<AdminApiResponse & { data?: SupportRequest[] }>('get', `/users/${login}/support-requests`);
      
      console.log('✅ [usersService] getUserSupportRequests ответ:', {
        success: response.success,
        requestsCount: response.data?.length || 0,
      });
      
      return response.data || [];
    } catch (error: any) {
      console.error('❌ [usersService] getUserSupportRequests ошибка:', error);
      throw error;
    }
  },
  
  // Получить детали конкретного запроса (с расшифрованными данными)
  getSupportRequestDetails: async (requestId: string): Promise<SupportRequest> => {
    console.log('🔍 [usersService] getSupportRequestDetails запрос:', requestId);
    
    try {
      const response = await apiRequest<AdminApiResponse & { data?: SupportRequest }>('get', `/support-requests/${requestId}`);
      
      console.log('✅ [usersService] getSupportRequestDetails ответ:', {
        success: response.success,
        hasData: !!response.data,
        requestType: response.data?.type,
        status: response.data?.status,
        isOverdue: response.data?.isOverdue,
      });
      
      if (!response.data) {
        throw new Error('Данные запроса не найдены');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ [usersService] getSupportRequestDetails ошибка:', error);
      throw error;
    }
  },
  
  // Валидировать запрос (проверить кодовое слово, пароль и т.д.)
  validateSupportRequest: async (requestId: string): Promise<ValidationResult> => {
    console.log('🔐 [usersService] validateSupportRequest запрос:', requestId);
    
    try {
      const response = await apiRequest<ValidationResult>('post', `/support-requests/${requestId}/validate`);
      
      console.log('✅ [usersService] validateSupportRequest ответ:', {
        success: response.success,
        isValid: response.isValid,
        message: response.message,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [usersService] validateSupportRequest ошибка:', error);
      throw error;
    }
  },
  
  processSupportRequest: async (
    requestId: string, 
    action: 'approve' | 'reject',
    data?: { 
      reason?: string; 
      emailResponse?: string; // для типа "other"
    }
  ): Promise<ProcessResult> => {
    console.log('⚡ [supportService.processSupportRequest] Запрос:', { 
      requestId, 
      action, 
      data 
    });
    
    try {
      // URL совпадает с роутом который мы добавили
      const response = await apiRequest<ProcessResult>(
        'post', 
        `/support/requests/${requestId}/process`, 
        { action, ...data }
      );
      
      console.log('✅ [supportService.processSupportRequest] Ответ:', {
        success: response.success,
        action: response.action,
        result: response.result,
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [supportService.processSupportRequest] Ошибка:', error);
      throw error;
    }
  }
};

// API методы для дашборда
export const dashboardService = {
  getStats: async (): Promise<AdminApiResponse & { data?: DashboardStats }> => {
    console.log('📊 [dashboardService] getStats начало');
    try {
      const response = await apiRequest<AdminApiResponse & { data?: DashboardStats }>('get', '/dashboard/stats');
      console.log('✅ [dashboardService] getStats успех:', {
        success: response.success,
        hasData: !!response.data,
        totalUsers: response.data?.totalUsers,
        activeUsers: response.data?.activeUsers,
      });
      return response;
    } catch (error) {
      console.error('❌ [dashboardService] Ошибка в getStats:', error);
      throw error;
    }
  },
  
  getActivity: async (limit: number = 10): Promise<AdminApiResponse> => {
    console.log('📋 [dashboardService] getActivity начало');
    return await apiRequest<AdminApiResponse>('get', '/dashboard/activity', undefined, { limit });
  },
  
  getServicesStatus: async (): Promise<AdminApiResponse> => {
    console.log('⚙️ [dashboardService] getServicesStatus начало');
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
    console.log('📩 [supportService.getUserSupportRequests] Запрос:', { 
      login, 
      type, 
      status 
    });
    
    try {
      const response = await apiRequest<SupportRequestsResponse>(
        'get', 
        `/support/user/${login}/requests`, 
        undefined, 
        { type, status }
      );
      
      console.log('✅ [supportService.getUserSupportRequests] Ответ:', {
        success: response.success,
        requestsCount: response.data?.requests?.length || 0,
        user: response.data?.user?.login,
        stats: response.data?.stats
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [supportService.getUserSupportRequests] Ошибка:', error);
      throw error;
    }
  },
  
  // Получить информацию о конкретном запросе
  getSupportRequestInfo: async (requestId: string): Promise<SupportRequestInfoResponse> => {
    console.log('🔍 [supportService.getSupportRequestInfo] Запрос:', requestId);
    
    try {
      const response = await apiRequest<SupportRequestInfoResponse>(
        'get', 
        `/support/requests/${requestId}`
      );
      
      console.log('✅ [supportService.getSupportRequestInfo] Ответ:', {
        success: response.success,
        hasRequest: !!response.data?.request,
        requestType: response.data?.request?.type,
        status: response.data?.request?.status,
        logsCount: response.data?.logs?.length || 0
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [supportService.getSupportRequestInfo] Ошибка:', error);
      throw error;
    }
  },
  
  // АВТОМАТИЧЕСКАЯ проверка запроса (расшифровка + сравнение)
  validateSupportRequest: async (requestId: string): Promise<ValidationResponse> => {
    console.log('🔐 [supportService.validateSupportRequest] Запрос:', requestId);
    
    try {
      const response = await apiRequest<ValidationResponse>(
        'post', 
        `/support/requests/${requestId}/validate`
      );
      
      console.log('✅ [supportService.validateSupportRequest] Ответ:', {
        success: response.success,
        isValid: response.isValid,
        errors: response.errors?.length || 0,
        checkedFields: response.checkedFields,
        requestInfo: response.requestInfo
      });
      
      return response;
    } catch (error: any) {
      console.error('❌ [supportService.validateSupportRequest] Ошибка:', error);
      throw error;
    }
  }
};

// Экспортируем обновленный объект (уже есть в конце файла)
// export default adminApi;

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