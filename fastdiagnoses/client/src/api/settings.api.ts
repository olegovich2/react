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
 
}

export const settingsAPI = new SettingsAPI();