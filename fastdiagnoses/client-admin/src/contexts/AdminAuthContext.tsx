import React, { createContext, useContext, useReducer, useEffect, useRef, useMemo, useCallback } from 'react';
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
  | { type: 'LOGIN_SUCCESS'; payload: { user: any; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'VERIFY_REQUEST' }
  | { type: 'VERIFY_SUCCESS'; payload: { user: any } }
  | { type: 'VERIFY_FAILURE' }
  | { type: 'CLEAR_ERROR' };

// Reducer
const authReducer = (state: AdminAuthState, action: AuthAction): AdminAuthState => {
  switch (action.type) {
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
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
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
  clearError: () => void;
} | null>(null);

// Provider компонент
export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const isInitialMount = useRef(true);
  const checkAuthCalled = useRef(false);
  const loginInProgress = useRef(false);

  // Проверка авторизации
  const checkAuth = useCallback(async () => {
    if (checkAuthCalled.current) return;
    
    checkAuthCalled.current = true;
    const token = localStorage.getItem('admin_token');
    
    if (!token) {
      dispatch({ type: 'VERIFY_FAILURE' });
      return;
    }

    dispatch({ type: 'VERIFY_REQUEST' });
    
    try {
      const response = await authService.verify();
      
      if (response.success && response.admin) {
        dispatch({ type: 'VERIFY_SUCCESS', payload: { user: response.admin } });
      } else {
        dispatch({ type: 'VERIFY_FAILURE' });
      }
    } catch {
      dispatch({ type: 'VERIFY_FAILURE' });
    }
  }, []);

  // Вход
  const login = useCallback(async (username: string, password: string) => {
    if (loginInProgress.current) {
      return { success: false, error: 'Уже выполняется вход' };
    }
    
    try {
      loginInProgress.current = true;
      
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
    } finally {
      loginInProgress.current = false;
    }
  }, []);

  // Выход
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Игнорируем ошибку при выходе
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  // Очистка ошибки
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Первичная проверка авторизации
  useEffect(() => {
    if (isInitialMount.current) {
      checkAuth();
      isInitialMount.current = false;
    }
  }, [checkAuth]);

  // Мемоизация контекстного значения
  const contextValue = useMemo(() => ({
    state,
    login,
    logout,
    checkAuth,
    clearError,
  }), [state, login, logout, checkAuth, clearError]);

  return (
    <AdminAuthContext.Provider value={contextValue}>
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
  
  return context;
};