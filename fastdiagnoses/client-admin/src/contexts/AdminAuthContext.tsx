import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../admin/services/adminApi';

// Типы состояния
interface AdminAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  error: string | null;
}

// Начальное состояние
const initialState: AdminAuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
};

// Типы действий
type AuthAction =
  | { type: 'LOGIN_REQUEST' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: any; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'VERIFY_REQUEST' }
  | { type: 'VERIFY_SUCCESS'; payload: { user: any } }
  | { type: 'VERIFY_FAILURE'; payload: string };

// Reducer
const authReducer = (state: AdminAuthState, action: AuthAction): AdminAuthState => {
  switch (action.type) {
    case 'LOGIN_REQUEST':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      localStorage.setItem('admin_token', action.payload.token);
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload.user,
        error: null,
      };
    case 'LOGIN_FAILURE':
      localStorage.removeItem('admin_token');
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: action.payload,
      };
    case 'LOGOUT':
      localStorage.removeItem('admin_token');
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      };
    case 'VERIFY_REQUEST':
      return { ...state, isLoading: true, error: null };
    case 'VERIFY_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload.user,
        error: null,
      };
    case 'VERIFY_FAILURE':
      localStorage.removeItem('admin_token');
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: action.payload,
      };
    default:
      return state;
  }
};

// Создаем контекст
const AdminAuthContext = createContext<{
  state: AdminAuthState;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
} | null>(null);

// Provider компонент
export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Проверка авторизации
  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token');
    
    if (!token) {
      dispatch({ type: 'VERIFY_FAILURE', payload: 'Токен отсутствует' });
      return;
    }

    dispatch({ type: 'VERIFY_REQUEST' });
    
    try {
      const response = await authService.verify();
      
      if (response.success && response.admin) {
        dispatch({ type: 'VERIFY_SUCCESS', payload: { user: response.admin } });
      } else {
        dispatch({ type: 'VERIFY_FAILURE', payload: response.message || 'Ошибка проверки токена' });
      }
    } catch (error: any) {
      dispatch({ type: 'VERIFY_FAILURE', payload: error.message || 'Ошибка проверки авторизации' });
    }
  };

  // Вход
  const login = async (username: string, password: string) => {
    dispatch({ type: 'LOGIN_REQUEST' });
    
    try {
      const response = await authService.login(username, password) as any;
      
      if (response.success && response.token) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user: response.admin, token: response.token }
        });
        return { success: true };
      } else {
        dispatch({ type: 'LOGIN_FAILURE', payload: response.message || 'Ошибка входа' });
        return { success: false, error: response.message };
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Ошибка подключения к серверу';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMsg });
      return { success: false, error: errorMsg };
    }
  };

  // Выход
  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Проверяем авторизацию при монтировании
  useEffect(() => {
    console.log('🔐 [AdminAuthProvider] Первичная проверка авторизации');
    checkAuth();
  }, []);

  return (
    <AdminAuthContext.Provider value={{ state, login, logout, checkAuth }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

// Хук для использования контекста
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  
  return {
    ...context.state,
    login: context.login,
    logout: context.logout,
    checkAuth: context.checkAuth,
  };
};