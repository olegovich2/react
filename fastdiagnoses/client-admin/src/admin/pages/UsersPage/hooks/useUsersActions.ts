import { useState } from 'react';
import { usersService } from '../../../services/adminApi';
import { User, Notification } from '../../../types';

// Вспомогательная функция для безопасного получения количества запросов
const getRequestCount = (user: User, requestType: string): number => {
  if (!user.supportRequests) return 0;
  
  switch (requestType) {
    case 'password_reset':
      return user.supportRequests.password_reset || 0;
    case 'email_change':
      return user.supportRequests.email_change || 0;
    case 'unblock':
      return user.supportRequests.unblock || 0;
    case 'account_deletion':
      return user.supportRequests.account_deletion || 0;
    case 'other':
      return user.supportRequests.other || 0;
    default:
      return 0;
  }
};

const useUsersActions = (fetchUsers: (page: number) => Promise<void>, currentPage: number) => {
  const [notification, setNotification] = useState<Notification | null>(null);

  // Показ уведомления
  const showNotification = (type: 'success' | 'error' | 'info' | null, message?: string) => {
    if (type === null) {
      setNotification(null);
      return;
    }
    
    if (!message) {
      return;
    }
    
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Сброс пароля (старая функция, которая вызывается напрямую для кнопки)
  const handleResetPassword = async (user: User) => {
    if (!window.confirm(`Сбросить пароль для ${user.login}? Новый пароль будет отправлен на email.`)) {
      return;
    }

    try {
      const response = await usersService.resetPassword(user.login);
      
      if (response.success) {
        showNotification('success', response.message || `Пароль для ${user.login} сброшен`);
      } else {
        showNotification('error', response.message || 'Ошибка сброса пароля');
      }
    } catch (error: any) {
      showNotification('error', error.message || 'Ошибка сброса пароля');
    }
  };

  // Обработчик клика по кнопке запроса (ВСЕ ТИПЫ возвращают пользователя)
  const handleRequestAction = async (user: User, requestType: string): Promise<User | null> => {    
    // ВСЕГДА возвращаем пользователя для открытия модалки техподдержки
    // UsersPage откроет модалку с проверкой активных запросов
    return user;
  };

  return {
    notification,
    handleResetPassword,
    handleRequestAction,
    showNotification,
  };
};

export default useUsersActions;