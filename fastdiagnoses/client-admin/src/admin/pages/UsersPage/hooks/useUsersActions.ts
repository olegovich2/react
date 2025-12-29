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
      console.error('❌ [useUsersActions] Не указано сообщение для уведомления');
      return;
    }
    
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Блокировка пользователя
  const handleBlockUser = (user: User) => {
    return user; // Возвращаем пользователя для модалки
  };

  // Разблокировка пользователя
  const handleUnblockUser = async (user: User) => {
    if (!window.confirm(`Разблокировать пользователя ${user.login}?`)) {
      return;
    }

    try {
      const response = await usersService.unblockUser(user.login);
      
      if (response.success) {
        showNotification('success', `Пользователь ${user.login} успешно разблокирован`);
        await fetchUsers(currentPage);
      } else {
        showNotification('error', response.message || 'Ошибка разблокировки');
      }
    } catch (error: any) {
      console.error('❌ Ошибка разблокировки:', error);
      showNotification('error', error.message || 'Ошибка разблокировки');
    }
  };

  // Сброс пароля
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
      console.error('❌ Ошибка сброса пароля:', error);
      showNotification('error', error.message || 'Ошибка сброса пароля');
    }
  };

  // Удаление пользователя
  const handleDeleteAccount = async (user: User) => {
    if (!window.confirm(`ВНИМАНИЕ! Удалить аккаунт пользователя ${user.login}? Все данные будут безвозвратно удалены.`)) {
      return;
    }

    try {
      const response = await usersService.deleteUser(user.login);
      
      if (response.success) {
        showNotification('success', response.message || `Аккаунт ${user.login} удален`);
        await fetchUsers(currentPage);
      } else {
        showNotification('error', response.message || 'Ошибка удаления аккаунта');
      }
    } catch (error: any) {
      console.error('❌ Ошибка удаления аккаунта:', error);
      showNotification('error', error.message || 'Ошибка удаления аккаунта');
    }
  };

  // Смена email
  const handleChangeEmail = async (user: User) => {
    const newEmail = window.prompt(`Введите новый email для пользователя ${user.login}:`, user.email);
    
    if (!newEmail || newEmail === user.email) {
      return;
    }
    
    if (!window.confirm(`Сменить email пользователя ${user.login} на ${newEmail}?`)) {
      return;
    }

    try {
      showNotification('info', `Функция изменения email для ${user.login} в разработке`);
      // TODO: Реализовать смену email через API
      // const response = await usersService.changeEmail(user.login, newEmail);
    } catch (error: any) {
      console.error('❌ Ошибка смены email:', error);
      showNotification('error', error.message || 'Ошибка смены email');
    }
  };

  // Обработчик клика по кнопке запроса
  const handleRequestAction = async (user: User, requestType: string): Promise<User | null> => {
    console.log(`📩 Обработка запроса ${requestType} для пользователя ${user.login}`);
    
    // Используем безопасную функцию для получения количества запросов
    const requestCount = getRequestCount(user, requestType);
    
    if (requestCount > 0) {
      // Открываем соответствующую модалку для запроса
      showNotification('info', `Открытие модалки для ${requestType} (${requestCount} запросов) пользователя ${user.login}`);
      // TODO: Здесь будет открытие модального окна с деталями запроса
      return null;
    } else {
      // Обычное действие (как раньше)
      switch (requestType) {
        case 'password_reset':
          await handleResetPassword(user);
          return null;
        case 'email_change':
          await handleChangeEmail(user);
          return null;
        case 'unblock':
          if (user.isBlocked) {
            await handleUnblockUser(user);
            return null;
          } else {
            return user; // Возвращаем пользователя для модалки блокировки
          }
        case 'account_deletion':
          await handleDeleteAccount(user);
          return null;
        case 'other':
          showNotification('info', `Запросы типа "другое" для ${user.login}`);
          return null;
        default:
          console.warn(`⚠️ Неизвестный тип запроса: ${requestType}`);
          return null;
      }
    }
  };

  return {
    notification,
    handleBlockUser,
    handleUnblockUser,
    handleResetPassword,
    handleRequestAction,
    showNotification,
    handleDeleteAccount,
    handleChangeEmail,
  };
};

export default useUsersActions;