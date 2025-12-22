import React, { createContext, useContext, useState, useEffect, useCallback} from 'react';
import { User, AuthContextType, AuthProviderProps } from './context.types';
import { fetchClient } from '../api/fetchClient';

// Создаем контекст для событий
const AuthEventContext = createContext<{
  triggerAuthRequired: () => void;
  triggerUserLoggedOut: () => void;
} | undefined>(undefined);

// Хук для работы с событиями аутентификации
export const useAuthEvents = () => {
  const context = useContext(AuthEventContext);
  if (!context) {
    throw new Error('useAuthEvents must be used within AuthProvider');
  }
  return context;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Сервис для управления данными пользователя (Singleton)
class UserDataService {
  private static instance: UserDataService;
  private listeners: Array<() => void> = [];

  private constructor() {}

  static getInstance(): UserDataService {
    if (!UserDataService.instance) {
      UserDataService.instance = new UserDataService();
    }
    return UserDataService.instance;
  }

  // Единый метод получения пользователя
  getUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  // Единый метод получения логина
  getLogin(): string | null {
    const user = this.getUser();
    return user?.login || null;
  }

  // Единый метод получения токена
  getToken(): string {
    try {
      return localStorage.getItem('token') || '';
    } catch {
      return '';
    }
  }

  // Единый метод сохранения данных пользователя
  saveUserData(userData: User, token: string): void {
    try {
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', token);
      this.notifyListeners();
    } catch (error) {
      console.error('Ошибка сохранения данных пользователя:', error);
    }
  }

  // Единый метод очистки данных
  clearAuthData(): void {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('tempData');
      this.notifyListeners();
    } catch (error) {
      console.error('Ошибка очистки данных аутентификации:', error);
    }
  }

  // Подписка на изменения
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Экспортируем сервис как синглтон
export const userDataService = UserDataService.getInstance();

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Инициализация при загрузке
  useEffect(() => {
    // Используем единый сервис для получения данных
    const storedUser = userDataService.getUser();
    const token = userDataService.getToken();
    
    if (storedUser && token) {
      setUser(storedUser);
    }
  }, []);

  // Подписка на изменения данных пользователя
  useEffect(() => {
    const unsubscribe = userDataService.subscribe(() => {
      setUser(userDataService.getUser());
    });
    
    return unsubscribe;
  }, []);

  // Единая функция для обработки событий аутентификации
  const triggerAuthRequired = useCallback(() => {
    console.warn('🔐 Требуется авторизация');
    userDataService.clearAuthData();
    if (window.location.pathname !== '/login' && 
        !window.location.pathname.includes('/confirm-email')) {
      window.location.href = '/login';
    }
  }, []);

  const triggerUserLoggedOut = useCallback(() => {
    console.log('👋 Пользователь вышел из системы');
    userDataService.clearAuthData();
  }, []);

  const login = async (login: string, password: string) => {
    try {
      const response = await fetchClient.login(login, password);
      
      if (response.success && response.data) {
        const userData: User = {
          login: response.data.user?.login || login,
          email: response.data.user?.email || '',
          token: response.data.token
        };
        
        // Используем единый сервис для сохранения
        userDataService.saveUserData(userData, response.data.token || '');
        setUser(userData);
        
        return { success: true };
      }
      
      return { success: false, message: response.message };
    } catch (error: any) {
      return { success: false, message: error.message || 'Ошибка входа' };
    }
  };

  const register = async (login: string, password: string, email: string) => {
    try {
      const response = await fetchClient.register(login, password, email);
      return response;
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message || 'Ошибка регистрации' 
      };
    }
  };

  const logout = async () => {
    try {
      await fetchClient.logout();
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    } finally {
      // Используем единый сервис для очистки
      userDataService.clearAuthData();
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  const eventValue = {
    triggerAuthRequired,
    triggerUserLoggedOut,
  };

  return (
    <AuthEventContext.Provider value={eventValue}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </AuthEventContext.Provider>
  );
};