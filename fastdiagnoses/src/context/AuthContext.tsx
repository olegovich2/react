import React, { createContext, useContext, useState, useEffect, useCallback} from 'react';
import { User, AuthContextType, AuthProviderProps } from './context.types';
import { fetchClient } from '../api/fetchClient';
import { userDataService } from '../services'; // ← НОВЫЙ ИМПОРТ
import { AUTH_EVENTS, EventHelpers } from '../services/auth/events'; // ← опционально

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Инициализация при загрузке
  useEffect(() => {
    console.log('🔄 AuthProvider: инициализация из userDataService');
    
    // Используем единый сервис для получения данных
    const storedUser = userDataService.getUser();
    const token = userDataService.getToken();
    
    if (storedUser && token) {
      console.log('✅ AuthProvider: пользователь найден в localStorage');
      setUser(storedUser);
    } else {
      console.log('⚠️ AuthProvider: пользователь не авторизован');
    }
  }, []);

  // Подписка на изменения данных пользователя
  useEffect(() => {
    console.log('📝 AuthProvider: подписка на userDataService');
    
    const unsubscribe = userDataService.subscribe(() => {
      console.log('🔄 AuthProvider: получено уведомление от userDataService');
      const updatedUser = userDataService.getUser();
      setUser(updatedUser);
    });
    
    return () => {
      console.log('📝 AuthProvider: отписка от userDataService');
      unsubscribe();
    };
  }, []);

  // Единая функция для обработки событий аутентификации
  const triggerAuthRequired = useCallback(() => {
    console.warn('🔐 Требуется авторизация');
    userDataService.clearAuthData();
    
    // Используем EventHelpers если подключены события
    if (EventHelpers) {
      EventHelpers.dispatch(AUTH_EVENTS.REQUIRED);
    } else {
      window.dispatchEvent(new CustomEvent('auth-required'));
    }
    
    if (window.location.pathname !== '/login' && 
        !window.location.pathname.includes('/confirm-email')) {
      console.log('📍 Перенаправление на /login');
      window.location.href = '/login';
    }
  }, []);

  const triggerUserLoggedOut = useCallback(() => {
    console.log('👋 Пользователь вышел из системы');
    userDataService.clearAuthData();
    
    // Используем EventHelpers если подключены события
    if (EventHelpers) {
      EventHelpers.dispatch(AUTH_EVENTS.LOGGED_OUT);
    } else {
      window.dispatchEvent(new CustomEvent('user-logged-out'));
    }
  }, []);

  const login = async (login: string, password: string) => {
    try {
      console.log(`🔐 AuthProvider.login: попытка входа для ${login}`);
      
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
        
        console.log('✅ AuthProvider.login: успешный вход');
        
        // Отправляем событие успешного входа
        if (EventHelpers) {
          EventHelpers.dispatch(AUTH_EVENTS.LOGIN_SUCCESS, { login: userData.login });
        }
        
        return { success: true };
      }
      
      console.error('❌ AuthProvider.login: ошибка от сервера', response.message);
      return { success: false, message: response.message };
    } catch (error: any) {
      console.error('❌ AuthProvider.login: исключение', error);
      return { success: false, message: error.message || 'Ошибка входа' };
    }
  };

  const register = async (login: string, password: string, email: string) => {
    try {
      console.log(`📝 AuthProvider.register: регистрация ${login}`);
      
      const response = await fetchClient.register(login, password, email);
      
      if (response.success && EventHelpers) {
        EventHelpers.dispatch(AUTH_EVENTS.REGISTER_SUCCESS, { login, email });
      }
      
      return response;
    } catch (error: any) {
      console.error('❌ AuthProvider.register: исключение', error);
      return { 
        success: false, 
        message: error.message || 'Ошибка регистрации' 
      };
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 AuthProvider.logout: выполнение выхода');
      await fetchClient.logout();
    } catch (error) {
      console.error('❌ AuthProvider.logout: ошибка при выходе:', error);
    } finally {
      // Используем единый сервис для очистки
      userDataService.clearAuthData();
      setUser(null);
      
      // Отправляем событие успешного выхода
      if (EventHelpers) {
        EventHelpers.dispatch(AUTH_EVENTS.LOGOUT_SUCCESS);
      }
      
      console.log('✅ AuthProvider.logout: выход завершен');
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

  console.log('🔄 AuthProvider: рендер провайдера');

  return (
    <AuthEventContext.Provider value={eventValue}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </AuthEventContext.Provider>
  );
};
