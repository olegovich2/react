import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/api.types';
import { login as apiLogin, register as apiRegister } from '../api/auth.api';

interface AuthContextType {
  user: User | null;
  login: (login: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (login: string, password: string, email: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Проверяем localStorage при загрузке
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      try {
        const userData: User = JSON.parse(storedUser);
        setUser(userData);
      } catch (error) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
  }, []);

  const login = async (login: string, password: string) => {
    try {
      const response = await apiLogin(login, password); // Передаем два аргумента
      
      if (response.success && response.data) {
        const userData: User = {
          login: response.data.user?.login || login,
          email: response.data.user?.email || '',
          token: response.data.token
        };
        
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', response.data.token || '');
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
      const response = await apiRegister(login, password, email); // Три аргумента
      return response;
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message || 'Ошибка регистрации' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};