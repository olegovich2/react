import { APIResponse } from '../types/api.types';

/**
 * Безопасный HTTP клиент для работы с API
 * Все валидации на сервере, клиент только передает данные
 */
class FetchClient {
  private baseURL: string;
  private isRefreshingToken = false;
  private refreshQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
    this.setupGlobalHandlers();
  }

  /**
   * Настройка глобальных обработчиков ошибок
   */
  private setupGlobalHandlers() {
    // Автоматический редирект на логин при 401
    window.addEventListener('auth-required', () => {
      this.clearAuthData();
      if (window.location.pathname !== '/login' && 
          !window.location.pathname.includes('/confirm-email')) {
        window.location.href = '/login';
      }
    });

    // Обработчик сетевых ошибок
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
    
    // Безопасное получение токена
    const token = this.getToken();
    
    // Базовые безопасные заголовки
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options.headers as Record<string, string> || {})
    };

    // Для FormData убираем Content-Type
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    // Логирование для отладки (только в development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 ${options.method || 'GET'} ${fullUrl}`, {
        hasToken: !!token,
        bodySize: options.body ? JSON.stringify(options.body).length : 0
      });
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
      
      // Проверка типа контента
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

      // Логирование медленных запросов
      if (responseTime > 3000) {
        console.warn(`⚠️ Медленный запрос ${url}: ${responseTime}ms`);
      }

      // Обработка HTTP ошибок
      if (!response.ok) {
        return this.handleErrorResponse(response.status, data, url);
      }

      // Успешный ответ
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
      case 400: // Bad Request
        console.error(`❌ Ошибка валидации (400) ${url}:`, data.message);
        break;

      case 401: // Unauthorized
        console.warn(`🔐 Требуется авторизация (401) ${url}`);
        this.clearAuthData();
        window.dispatchEvent(new CustomEvent('auth-required'));
        break;

      case 403: // Forbidden
        console.error(`⛔ Доступ запрещен (403) ${url}:`, data.message);
        if (data.message?.includes('не активирован')) {
          window.dispatchEvent(new CustomEvent('account-not-activated'));
        }
        break;

      case 404: // Not Found
        console.error(`🔍 Не найдено (404) ${url}`);
        break;

      case 429: // Too Many Requests
        console.error(`🐌 Слишком много запросов (429) ${url}`);
        errorResult.message = 'Слишком много запросов. Подождите немного.';
        break;

      case 500: // Internal Server Error
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

  /**
   * Безопасное получение токена
   */
  private getToken(): string {
    try {
      return localStorage.getItem('token') || '';
    } catch (error) {
      console.error('Ошибка получения токена из localStorage:', error);
      return '';
    }
  }

  /**
   * Безопасное сохранение токена
   */
  private setToken(token: string): void {
    try {
      localStorage.setItem('token', token);
    } catch (error) {
      console.error('Ошибка сохранения токена в localStorage:', error);
    }
  }

  /**
   * Очистка данных аутентификации
   */
  private clearAuthData(): void {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('tempData');
    } catch (error) {
      console.error('Ошибка очистки данных аутентификации:', error);
    }
  }

  // ==================== HTTP МЕТОДЫ ====================

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

  // ==================== АУТЕНТИФИКАЦИЯ ====================

  /**
   * Вход пользователя
   */
  async login(login: string, password: string) {
    const response = await this.post<{
      token: string;
      user: {
        login: string;
        email: string;
        createdAt: string;
      }
    }>('/auth/login', { login, password });
    
    if (response.success && response.data) {
      this.setToken(response.data.token);
      this.saveUserData(response.data.user);
    }
    
    return response;
  }

  /**
   * Регистрация пользователя
   */
  async register(login: string, password: string, email: string) {
    return this.post<{ message: string }>('/auth/register', {
      login,
      password,
      email
    });
  }

  /**
   * Подтверждение email
   */
  async confirmEmail(token: string) {
    return this.get<{ message: string }>(`/auth/confirm/${token}`);
  }

  /**
   * Проверка JWT токена
   */
  async verifyToken() {
    return this.post<{ 
      user: { 
        login: string; 
        sessionId: number;
      } 
    }>('/auth/verify', {});
  }

  /**
   * Выход пользователя
   */
  async logout() {
    const response = await this.post<{ message: string }>('/auth/logout', {});
    if (response.success) {
      this.clearAuthData();
      window.dispatchEvent(new CustomEvent('user-logged-out'));
    }
    return response;
  }

  /**
   * Сохранение данных пользователя
   */
  private saveUserData(user: any) {
    try {
      localStorage.setItem('user', JSON.stringify({
        login: user.login,
        email: user.email,
        createdAt: user.createdAt
      }));
    } catch (error) {
      console.error('Ошибка сохранения данных пользователя:', error);
    }
  }

  /**
   * Получение данных текущего пользователя
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  // ==================== ОПРОСЫ ====================

  /**
   * Сохранение опроса
   */
  async saveSurvey(surveyData: any) {
    return this.post<{ message: string }>('/surveys/save', {
      survey: surveyData
    });
  }

  /**
   * Получение всех опросов и изображений пользователя
   */
  async getSurveys() {
    return this.get<{
      surveys: Array<{
        id: number;
        survey: any;
        createdAt: string;
      }>;
      images: Array<{
        id: number;
        fileName: string;
        comment: string;
        smallImage: string;
        createdAt: string;
      }>;
    }>('/surveys');
  }

  /**
   * Удаление опроса или изображения
   */
  async deleteSurveyOrImage(id: number) {
    return this.delete<{ message: string }>(`/surveys/${id}`);
  }

  // ==================== ИЗОБРАЖЕНИЯ ====================

  /**
   * Загрузка изображения (Base64)
   */
  async uploadImageBase64(filename: string, base64Data: string, comment?: string) {
    return this.post<{ message: string }>('/images/upload', {
      filename,
      file: base64Data,
      comment: comment || ''
    });
  }

  /**
   * Получение оригинального изображения
   */
  async getImage(id: number) {
    return this.get<{ filename: string; image: string }>(`/images/${id}`);
  }

  // ==================== ДИАГНОЗЫ ====================

  /**
   * Поиск диагнозов и рекомендаций
   */
  async searchDiagnoses(titles: string[]) {
    return this.post<{
      titles: string[];
      diagnostic: string[];
      treatment: string[];
    }>('/diagnoses/search', { titles });
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
    return !!this.getToken();
  }

  /**
   * Получение токена (публичный метод)
   */
  getTokenPublic(): string | null {
    try {
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  }
}

// Создаем экземпляр клиента
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api'  // В production - относительный путь
  : 'http://localhost:5000/api';  // В development

export const fetchClient = new FetchClient(API_URL);