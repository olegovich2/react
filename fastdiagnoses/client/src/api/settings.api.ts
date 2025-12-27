import { fetchClient } from './fetchClient';

export interface UserInfo {
  login: string;
  email: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  secretWord: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
  requireReauth: boolean;
  emailSent?: boolean;
}

export interface EmailChangeRequestData {
  currentEmail: string;
  newEmail: string;
  reason: string;
}

export interface EmailChangeResponse {
  success: boolean;
  message: string;
  notification?: string;
}

class SettingsAPI {
  /**
   * Получение информации о пользователе
   */
  async getUserInfo() {
    return fetchClient.get<{ user: UserInfo }>('/settings/user-info');
  }

  /**
   * Смена пароля пользователя
   */
  async changePassword(data: ChangePasswordData) {
    return fetchClient.post<ChangePasswordResponse>('/settings/change-password', data);
  }

  /**
   * Удаление аккаунта пользователя
   */
  async deleteAccount() {
    return fetchClient.delete<{ message: string }>('/settings/delete-account');
  }

  /**
   * Отправка запроса на смену email администратору
   */
  async requestEmailChange(data: EmailChangeRequestData) {
    return fetchClient.post<EmailChangeResponse>('/settings/email-change-request', data);
  }
}

export const settingsAPI = new SettingsAPI();