/**
 * API сервис для всех операций аутентификации
 * Включает: логин, регистрацию, восстановление пароля
 * По аналогии с settings.api
 */

import { fetchClient } from './fetchClient';

// ==================== ТИПЫ ДЛЯ ВОССТАНОВЛЕНИЯ ПАРОЛЯ ====================

export interface ForgotPasswordRequest {
  email: string;
  secretWord?: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  status?: number;
}

export interface ValidateResetTokenResponse {
  success: boolean;
  valid: boolean;
  email?: string;
  message?: string;
  expiresAt?: string;
  status?: number;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
  requireReauth?: boolean;
  emailSent?: boolean;
  status?: number;
}

// ==================== КЛАСС ЛОГИН API ====================

export class LoginAPI {
  /**
   * СУЩЕСТВУЮЩИЕ МЕТОДЫ (обертки для обратной совместимости)
   */
  
  async login(login: string, password: string) {
    console.log(`🔐 LoginAPI.login: запрос для ${login}`);
    return fetchClient.login(login, password);
  }
  
  async register(login: string, password: string, email: string, secretWord: string) {
  console.log(`📝 LoginAPI.register: запрос для ${login} с кодовым словом`);
  return fetchClient.register(login, password, email, secretWord);
}
  
  async confirmEmail(token: string) {
    console.log(`📧 LoginAPI.confirmEmail: подтверждение email`);
    return fetchClient.confirmEmail(token);
  }
  
  async verifyToken() {
    console.log(`✅ LoginAPI.verifyToken: проверка токена`);
    return fetchClient.verifyToken();
  }
  
  async logout() {
    console.log(`🚪 LoginAPI.logout: выход из системы`);
    return fetchClient.logout();
  }
  
  // ==================== НОВЫЕ МЕТОДЫ ВОССТАНОВЛЕНИЯ ПАРОЛЯ ====================
  
  /**
   * 1. Запрос на восстановление пароля
   * @param email Email пользователя
   */
  async forgotPassword(email: string, secretWord?: string): Promise<ForgotPasswordResponse> {
  console.log(`🔐 LoginAPI.forgotPassword: запрос для ${email}`);
  
  try {
    const requestData: ForgotPasswordRequest = { 
      email,
      ...(secretWord && { secretWord }) // Добавляем если передано
    };
    
    const response = await fetchClient.post<ForgotPasswordResponse>(
      '/auth/forgot-password', 
      requestData
    );
    
    console.log('📊 LoginAPI.forgotPassword результат:', {
      success: response.success,
      message: response.message?.substring(0, 50) + '...',
      hasSecretWord: !!secretWord
    });
    
    return {
      success: response.success,
      message: response.message || 'Ошибка обработки запроса',
      status: response.status
    };
  } catch (error: any) {
    console.error('❌ LoginAPI.forgotPassword ошибка:', error);
    return {
      success: false,
      message: error.message || 'Ошибка сети',
      status: 0
    };
  }
}
  
  /**
   * 2. Проверка валидности токена восстановления
   * @param token Токен из ссылки
   */
  async validateResetToken(token: string): Promise<ValidateResetTokenResponse> {
    console.log(`✅ LoginAPI.validateResetToken: проверка токена`);
    
    try {
      const response = await fetchClient.get<ValidateResetTokenResponse>(
        `/auth/validate-reset-token/${token}`
      );
      
      console.log('📊 LoginAPI.validateResetToken результат:', {
        success: response.success,
        valid: response.data?.valid,
        email: response.data?.email?.substring(0, 3) + '***' // Частично скрываем
      });
      
      return {
        success: response.success,
        valid: response.data?.valid || false,
        email: response.data?.email,
        message: response.message,
        expiresAt: response.data?.expiresAt,
        status: response.status
      };
    } catch (error: any) {
      console.error('❌ LoginAPI.validateResetToken ошибка:', error);
      return {
        success: false,
        valid: false,
        message: error.message || 'Ошибка проверки токена',
        status: 0
      };
    }
  }
  
  /**
   * 3. Установка нового пароля по токену
   * @param token Токен восстановления
   * @param newPassword Новый пароль
   * @param confirmPassword Подтверждение пароля (опционально)
   */
  async resetPassword(
    token: string, 
    newPassword: string, 
    confirmPassword?: string
  ): Promise<ResetPasswordResponse> {
    console.log(`🔐 LoginAPI.resetPassword: установка нового пароля`);
    
    try {
      const requestData: ResetPasswordRequest = {
        token,
        newPassword,
        ...(confirmPassword && { confirmPassword })
      };
      
      const response = await fetchClient.post<ResetPasswordResponse>(
        '/auth/reset-password', 
        requestData
      );
      
      console.log('📊 LoginAPI.resetPassword результат:', {
        success: response.success,
        message: response.message,
        requireReauth: response.data?.requireReauth
      });
      
      return {
        success: response.success,
        message: response.message || 'Ошибка установки пароля',
        requireReauth: response.data?.requireReauth,
        emailSent: response.data?.emailSent,
        status: response.status
      };
    } catch (error: any) {
      console.error('❌ LoginAPI.resetPassword ошибка:', error);
      return {
        success: false,
        message: error.message || 'Ошибка сети',
        status: 0
      };
    }
  }
  
  /**
   * 4. Смена пароля для авторизованного пользователя
   * (Существующий метод, добавляем сюда для полноты)
   */
  async changePassword(currentPassword: string, newPassword: string) {
    console.log(`🔐 LoginAPI.changePassword: смена пароля`);
    return fetchClient.post('/settings/change-password', {
      currentPassword,
      newPassword
    });
  }
}

// ==================== ЭКСПОРТ СИНГЛТОНА ====================

/**
 * Экземпляр LoginAPI для использования во всем приложении
 */
export const loginAPI = new LoginAPI();

// ==================== ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ====================

/**
 * Прямой экспорт методов для удобства
 */
export const authApi = {
  // Существующие методы
  login: (login: string, password: string) => loginAPI.login(login, password),
  register: (login: string, password: string, email: string, secretWord: string) => 
    loginAPI.register(login, password, email, secretWord),
  confirmEmail: (token: string) => loginAPI.confirmEmail(token),
  verifyToken: () => loginAPI.verifyToken(),
  logout: () => loginAPI.logout(),
  
  // Новые методы восстановления пароля
  forgotPassword: (email: string, secretWord?: string) => loginAPI.forgotPassword(email, secretWord),
  validateResetToken: (token: string) => loginAPI.validateResetToken(token),
  resetPassword: (token: string, newPassword: string, confirmPassword?: string) => 
    loginAPI.resetPassword(token, newPassword, confirmPassword),
  changePassword: (currentPassword: string, newPassword: string) => 
    loginAPI.changePassword(currentPassword, newPassword)
};