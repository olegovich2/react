import { 
  APIResponse,
  AuthLoginResponseData,
  AuthVerifyResponseData,
  DiagnosisSearchResponseData,
  SearchDiagnosesBody,
} from '../components/AccountPage/types/account.types'; 
import { userDataService } from '../context/AuthContext';

/**
 * Безопасный HTTP клиент для работы с API
 * ТОЛЬКО базовые HTTP методы, без бизнес-логики
 */
class FetchClient {
  private baseURL: string;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
    this.setupGlobalHandlers();
  }

  /**
   * Настройка глобальных обработчиков ошибок
   */
  private setupGlobalHandlers() {
    window.addEventListener('auth-required', () => {
      userDataService.clearAuthData();
      
      if (window.location.pathname !== '/login' && 
          !window.location.pathname.includes('/confirm-email')) {
        window.location.href = '/login';
      }
    });

    window.addEventListener('offline', () => {
      console.warn('Соединение потеряно');
    });
  }

  /**
   * Основной безопасный метод запроса
   */
  async request<T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<APIResponse & { data?: T; field?: string }> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    const token = userDataService.getToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options.headers as Record<string, string> || {})
    };

    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 ${options.method || 'GET'} ${fullUrl}`);
    }

    try {
      const startTime = Date.now();
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
        body: options.body instanceof FormData 
          ? options.body 
          : options.body ? JSON.stringify(options.body) : undefined
      });

      const responseTime = Date.now() - startTime;
      
      const contentType = response.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text || 'Некорректный ответ сервера' };
        }
      }

      if (responseTime > 3000) {
        console.warn(`⚠️ Медленный запрос ${url}: ${responseTime}ms`);
      }

      if (!response.ok) {
        return this.handleErrorResponse(response.status, data, url);
      }

      return {
        success: true,
        data: data as T,
        status: response.status,
        responseTime
      };

    } catch (error: any) {
      return this.handleNetworkError(error, url);
    }
  }

  /**
   * Обработка HTTP ошибок
   */
  private handleErrorResponse(status: number, data: any, url: string) {
    const errorResult: APIResponse & { field?: string } = {
      success: false,
      message: data.message || `Ошибка ${status}`,
      status,
      field: data.field
    };

    switch (status) {
      case 400:
        console.error(`❌ Ошибка валидации (400) ${url}:`, data.message);
        break;

      case 401:
        console.warn(`🔐 Требуется авторизация (401) ${url}`);
        window.dispatchEvent(new CustomEvent('auth-required'));
        break;

      case 403:
        console.error(`⛔ Доступ запрещен (403) ${url}:`, data.message);
        if (data.message?.includes('не активирован')) {
          window.dispatchEvent(new CustomEvent('account-not-activated'));
        }
        break;

      case 404:
        console.error(`🔍 Не найдено (404) ${url}`);
        break;

      case 429:
        console.error(`🐌 Слишком много запросов (429) ${url}`);
        errorResult.message = 'Слишком много запросов. Подождите немного.';
        break;

      case 500:
        console.error(`💥 Ошибка сервера (500) ${url}:`, data.message);
        errorResult.message = 'Внутренняя ошибка сервера. Попробуйте позже.';
        break;

      default:
        console.error(`❓ Неизвестная ошибка (${status}) ${url}:`, data.message);
    }

    return errorResult;
  }

  /**
   * Обработка сетевых ошибок
   */
  private handleNetworkError(error: any, url: string): APIResponse {
    console.error(`🌐 Сетевая ошибка ${url}:`, error);

    let message = 'Неизвестная ошибка сети';

    if (error.message?.includes('Failed to fetch')) {
      message = 'Ошибка соединения с сервером. Проверьте интернет.';
      window.dispatchEvent(new CustomEvent('connection-error'));
    } else if (error.name === 'AbortError') {
      message = 'Запрос отменен';
    } else if (error.name === 'TimeoutError') {
      message = 'Таймаут запроса';
    } else if (error.message) {
      message = error.message;
    }

    return {
      success: false,
      message,
      status: 0
    };
  }

  // ==================== БАЗОВЫЕ HTTP МЕТОДЫ (ТОЛЬКО ЭТО!) ====================

  async get<T = any>(url: string): Promise<APIResponse & { data?: T }> {
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T = any>(url: string, data?: any): Promise<APIResponse & { data?: T }> {
    return this.request<T>(url, { 
      method: 'POST', 
      body: data 
    });
  }

  async put<T = any>(url: string, data?: any): Promise<APIResponse & { data?: T }> {
    return this.request<T>(url, { 
      method: 'PUT', 
      body: data 
    });
  }

  async delete<T = any>(url: string, data?: any): Promise<APIResponse & { data?: T }> {
    return this.request<T>(url, { 
      method: 'DELETE', 
      body: data 
    });
  }

  // ==================== АУТЕНТИФИКАЦИЯ (основные методы) ====================

  async login(login: string, password: string) {
    const response = await this.post<AuthLoginResponseData>('/auth/login', { login, password });
    
    if (response.success && response.data) {
      userDataService.saveUserData(
        {
          login: response.data.user?.login || login,
          email: response.data.user?.email || '',
          token: response.data.token
        },
        response.data.token || ''
      );
    }
    
    return response;
  }

  async register(login: string, password: string, email: string) {
    return this.post<{ message: string }>('/auth/register', {
      login,
      password,
      email
    });
  }

  async confirmEmail(token: string) {
    return this.get<{ message: string }>(`/auth/confirm/${token}`);
  }

  async verifyToken() {
    return this.post<AuthVerifyResponseData>('/auth/verify', {});
  }

  async logout() {
    const response = await this.post<{ message: string }>('/auth/logout', {});
    if (response.success) {
      window.dispatchEvent(new CustomEvent('user-logged-out'));
    }
    return response;
  }

  // ==================== СПЕЦИАЛЬНЫЕ МЕТОДЫ (только если нет в API модулях) ====================

  /**
   * Поиск диагнозов и рекомендаций (публичный эндпоинт, без аутентификации)
   */
  async searchDiagnoses(titles: string[]) {
    const body: SearchDiagnosesBody = { titles };
    return this.post<DiagnosisSearchResponseData>('/diagnoses/search', body);
  }

  /**
   * Получение всех данных с пагинацией и поиском (общий метод)
   */
  async getPaginatedData(params?: any) {
    return this.post<{
      data: Array<{
        id: number;
        type: 'survey' | 'image';
        date?: string;
        survey?: any;
        fileName?: string;
        originIMG?: string;
        comment?: string;
        smallImage?: string;
      }>;
      pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      }
    }>('/data/search', params || {});
  }

  // ==================== УТИЛИТЫ ====================

  /**
   * Проверка соединения с сервером
   */
  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Отмена запроса
   */
  createAbortController() {
    return new AbortController();
  }

  /**
   * Установка базового URL
   */
  setBaseURL(url: string) {
    this.baseURL = url;
    console.log(`🔧 Base URL изменен на: ${url}`);
  }

  /**
   * Получение текущего базового URL
   */
  getBaseURL() {
    return this.baseURL;
  }

  /**
   * Проверка авторизации
   */
  isAuthenticated(): boolean {
    return !!userDataService.getToken();
  }

  /**
   * Получение токена
   */
  getTokenPublic(): string | null {
    return userDataService.getToken() || null;
  }

  /**
   * Получение текущего пользователя
   */
  getCurrentUser() {
    return userDataService.getUser();
  }

  /**
   * Получение логина текущего пользователя
   */
  getCurrentLogin(): string | null {
    return userDataService.getLogin();
  }

  /**
   * Получение заголовков с авторизацией
   */
  getAuthHeaders(): Record<string, string> {
    const token = userDataService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }
}

// Создаем экземпляр клиента
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api'
  : 'http://localhost:5000/api';

export const fetchClient = new FetchClient(API_URL);