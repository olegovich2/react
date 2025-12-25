import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/adminApi';
import { AuthResponse } from '../types';

export interface AdminAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  error: string | null;
}

export const useAdminAuth = () => {
  const [authState, setAuthState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // Проверка аутентификации
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    
    if (!token) {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
      }));
      return;
    }

    try {
      const response = await authService.verify() as AuthResponse;
      
      if (response.success && response.user) {
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: response.user,
          error: null,
        });
      } else {
        localStorage.removeItem('admin_token');
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: response.message || 'Ошибка проверки токена',
        });
      }
    } catch (error: any) {
      localStorage.removeItem('admin_token');
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error.message || 'Ошибка проверки авторизации',
      });
    }
  }, []);

  // Вход
  const login = async (username: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await authService.login(username, password) as AuthResponse;
      
      if (response.success && response.token) {         
        localStorage.setItem('admin_token', response.token);
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: response.user || null,
          error: null,
        });
        return { success: true };
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: response.message || 'Ошибка входа',
        });
        return { success: false, error: response.message };
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Ошибка подключения к серверу';
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMsg,
      });
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
      localStorage.removeItem('admin_token');
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    }
  };

  // Проверяем авторизацию при монтировании
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    ...authState,
    login,
    logout,
    checkAuth,
  };
};