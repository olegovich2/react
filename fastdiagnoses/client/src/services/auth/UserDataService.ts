/**
 * Сервис для управления данными пользователя
 * Singleton паттерн
 * Вынесен из AuthContext для устранения циклических зависимостей
 */

import { User } from '../../context/context.types'; // или откуда у вас типы

class UserDataService {
  private static instance: UserDataService;
  private listeners: Array<() => void> = [];

  private constructor() {
    console.log('✅ UserDataService инициализирован');
  }

  /**
   * Получение экземпляра сервиса (Singleton)
   */
  static getInstance(): UserDataService {
    if (!UserDataService.instance) {
      UserDataService.instance = new UserDataService();
    }
    return UserDataService.instance;
  }

  /**
   * Получение данных пользователя из localStorage
   */
  getUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      
      const user = JSON.parse(userStr);
      console.log('🔍 UserDataService.getUser():', user?.login || 'null');
      return user;
    } catch (error) {
      console.error('❌ Ошибка получения пользователя из localStorage:', error);
      return null;
    }
  }

  /**
   * Получение логина пользователя
   */
  getLogin(): string | null {
    const user = this.getUser();
    return user?.login || null;
  }

  /**
   * Получение токена из localStorage
   */
  getToken(): string {
    try {
      const token = localStorage.getItem('token') || '';
      console.log('🔑 UserDataService.getToken():', token ? 'есть' : 'нет');
      return token;
    } catch (error) {
      console.error('❌ Ошибка получения токена из localStorage:', error);
      return '';
    }
  }

  /**
   * Сохранение данных пользователя и токена
   */
  saveUserData(userData: User, token: string): void {
    try {
      console.log('💾 UserDataService.saveUserData():', {
        login: userData.login,
        tokenLength: token.length
      });
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', token);
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Ошибка сохранения данных пользователя:', error);
    }
  }

  /**
   * Очистка всех данных аутентификации
   */
  clearAuthData(): void {
    try {
      console.log('🧹 UserDataService.clearAuthData()');
      
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('tempData');
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Ошибка очистки данных аутентификации:', error);
    }
  }

  /**
   * Подписка на изменения данных пользователя
   * @returns Функция для отписки
   */
  subscribe(listener: () => void): () => void {
    console.log('📝 UserDataService.subscribe() - новый слушатель');
    this.listeners.push(listener);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
      console.log('📝 UserDataService - слушатель удален');
    };
  }

  /**
   * Уведомление всех слушателей об изменениях
   */
  private notifyListeners(): void {
    console.log(`🔔 UserDataService.notifyListeners() - ${this.listeners.length} слушателей`);
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('❌ Ошибка в слушателе UserDataService:', error);
      }
    });
  }

  /**
   * Проверка авторизации пользователя
   */
  isAuthenticated(): boolean {
    const hasToken = !!this.getToken();
    const hasUser = !!this.getUser();
    console.log('🔐 UserDataService.isAuthenticated():', { hasToken, hasUser });
    return hasToken && hasUser;
  }

  /**
   * Получение заголовков с авторизацией для запросов
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  /**
   * Очистка всех слушателей (для тестирования)
   */
  clearListeners(): void {
    console.log('🧹 UserDataService.clearListeners()');
    this.listeners = [];
  }
}

// Экспортируем синглтон
export const userDataService = UserDataService.getInstance();
export type { UserDataService };