/**
 * Типы для React Context (контекстов приложения)
 * Вынесены из api.types.ts для уменьшения связности
 */

// ==================== ТИПЫ ДЛЯ АУТЕНТИФИКАЦИИ ====================

/**
 * Пользователь системы
 */
export interface User {
  id?: number;
  login: string;
  email: string;
  createdAt?: string;
  token?: string;
}

/**
 * Ответ API аутентификации
 */
export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    login: string;
    email: string;
    createdAt?: string;
  };
  message?: string;
  status?: number;
}

/**
 * Ответ проверки JWT токена
 */
export interface JWTVerifyResponse {
  success: boolean;
  user?: {
    login: string;
    sessionId: number;
  };
  message?: string;
}

/**
 * Тип для AuthContext
 */
export interface AuthContextType {
  user: User | null;
  login: (login: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (login: string, password: string, email: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

/**
 * Пропсы для AuthProvider
 */
export interface AuthProviderProps {
  children: React.ReactNode;
}