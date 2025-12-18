import { 
  APIResponse,
  SurveysResponseData,
  ImageUploadResponse,
  PaginatedSurveysResponseData,
  SingleSurveyResponseData,
  ImagesResponseData,
  PaginatedImagesResponseData,
  SingleImageResponseData,
  DeleteResponseData,
  AuthLoginResponseData,
  AuthVerifyResponseData,
  AllUserDataResponseData,
  DiagnosisSearchResponseData,
  SaveSurveyBody,
  UploadImageBody,
  SearchDiagnosesBody,
  PaginationParams,
  SearchParams,
} from '../components/AccountPage/types/account.types'; 

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
    window.addEventListener('auth-required', () => {
      this.clearAuthData();
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
    
    const token = this.getToken();
    
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
        this.clearAuthData();
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

  // ==================== HTTP МЕТОДЫ (БЕЗ ИЗМЕНЕНИЙ) ====================

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

  // ==================== АУТЕНТИФИКАЦИЯ (С ТИПАМИ) ====================

  /**
   * Вход пользователя
   */
  async login(login: string, password: string) {
    const response = await this.post<AuthLoginResponseData>('/auth/login', { login, password });
    
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
    return this.post<AuthVerifyResponseData>('/auth/verify', {});
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

  /**
   * Получение логина текущего пользователя
   */
  getCurrentLogin(): string | null {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return user.login || null;
    } catch {
      return null;
    }
  }

  // ==================== ОПРОСЫ (С ПРАВИЛЬНЫМИ ТИПАМИ) ====================

  /**
   * Сохранение опроса (БЕЗ логина в body - сервер берет из токена)
   */
  async saveSurvey(surveyData: SaveSurveyBody) {
    return this.post<{ message: string }>('/surveys/save', surveyData);
  }

  /**
   * Получение опросов пользователя (БЕЗ логина в body - сервер берет из токена)
   */
  async getSurveys() {
    return this.post<SurveysResponseData>('/surveys', {});
  }

  /**
   * Получение конкретного опроса (БЕЗ логина в query - сервер берет из токена)
   */
  async getSurveyById(id: number) {
    return this.get<SingleSurveyResponseData>(`/surveys/${id}`);
  }

  /**
   * Удаление опроса или изображения
   */
  async deleteSurveyOrImage(id: number) {
    return this.delete<DeleteResponseData>(`/data/${id}`);
  }

  // ==================== ИЗОБРАЖЕНИЯ (С ПРАВИЛЬНЫМИ ТИПАМИ) ====================

  /**
   * Получение изображений пользователя (БЕЗ логина в body - сервер берет из токена)
   */
  async getImages() {
    return this.post<ImagesResponseData>('/images', {});
  }

  /**
   * Получение конкретного изображения (БЕЗ логина в query - сервер берет из токена)
   */
  async getImageById(id: number) {
    return this.get<SingleImageResponseData>(`/images/${id}`);
  }

  /**
   * Загрузка изображения (Base64) БЕЗ логина в body - сервер берет из токена
   */
  async uploadImageBase64(filename: string, base64Data: string, comment?: string) {
    const body: UploadImageBody = {
      filename,
      file: base64Data,
      comment: comment || ''
    };
    return this.post<ImageUploadResponse>('/images/upload', body);
  }

  // ==================== СТАРЫЕ ЭНДПОИНТЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ====================

  /**
   * Получение всех данных пользователя (опросы + изображения)
   * Старый эндпоинт для обратной совместимости (БЕЗ логина в body)
   */
  async getAllUserData() {
    return this.post<AllUserDataResponseData>('/surveys/old', {});
  }

  // ==================== ДИАГНОЗЫ (С ТИПАМИ) ====================

  /**
   * Поиск диагнозов и рекомендаций (публичный эндпоинт, без аутентификации)
   */
  async searchDiagnoses(titles: string[]) {
    const body: SearchDiagnosesBody = { titles };
    return this.post<DiagnosisSearchResponseData>('/diagnoses/search', body);
  }

  // ==================== ПАГИНАЦИЯ (С ПРАВИЛЬНЫМИ ТИПАМИ) ====================

  /**
   * Получение опросов с пагинацией
   */
  async getPaginatedSurveys(params?: PaginationParams) {
    return this.post<PaginatedSurveysResponseData>('/surveys/paginated', params || {});
  }

  /**
   * Получение изображений с пагинацией
   */
  async getPaginatedImages(params?: PaginationParams) {
    return this.post<PaginatedImagesResponseData>('/images/paginated', params || {});
  }

  /**
   * Получение всех данных с пагинацией и поиском
   */
  async getPaginatedData(params?: SearchParams) {
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

  // ==================== УТИЛИТЫ (БЕЗ ИЗМЕНЕНИЙ) ====================

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

  /**
   * Получение заголовков с авторизацией
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
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