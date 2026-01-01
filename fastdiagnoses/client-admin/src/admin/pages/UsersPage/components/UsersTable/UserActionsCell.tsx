import React from 'react';
import { User } from '../../../../types';

interface UserActionsCellProps {
  user: User;
  isLoading: boolean;
  onRequestAction: (user: User, requestType: string) => Promise<User | null>;
  onResetPassword: (user: User) => Promise<void>;
}

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

// Функция для безопасного получения заголовка кнопки
const getButtonTitle = (user: User, requestType: string): string => {
  const count = getRequestCount(user, requestType);
  
  switch (requestType) {
    case 'password_reset':
      return count > 0 
        ? `Сброс пароля (${count} запросов)`
        : 'Сброс пароля';
    case 'email_change':
      return count > 0 
        ? `Смена email (${count} запросов)`
        : 'Смена email';
    case 'unblock':
      return count > 0 
        ? `Разблокировка (${count} запросов)`
        : (user.isBlocked ? 'Запрос на разблокировку' : 'Заблокировать');
    case 'account_deletion':
      return count > 0 
        ? `Удаление аккаунта (${count} запросов)`
        : 'Запрос на удаление аккаунта';
    case 'other':
      return count > 0 
        ? `Другие запросы (${count} запросов)`
        : 'Другие запросы';
    default:
      return 'Действие';
  }
};

const UserActionsCell: React.FC<UserActionsCellProps> = ({
  user,
  isLoading,
  onRequestAction,
  onResetPassword
}) => {
  // Получение иконки для типа запроса
  const getRequestTypeIcon = (type: string): string => {
    switch (type) {
      case 'password_reset': return '🔑';
      case 'email_change': return '✉️';
      case 'unblock': return user.isBlocked ? '🔓' : '🔒';
      case 'account_deletion': return '🗑️';
      case 'other': return '❓';
      default: return '📩';
    }
  };

  // Получение класса для кнопки
  const getRequestButtonClass = (requestType: string): string => {
    const baseClass = 'users-table-action-button-compact';
    
    switch (requestType) {
      case 'password_reset': 
        return `${baseClass} users-table-action-password`;
      case 'email_change': 
        return `${baseClass} users-table-action-email`;
      case 'unblock': 
        return `${baseClass} ${user.isBlocked 
          ? 'users-table-action-unblock' 
          : 'users-table-action-block'}`;
      case 'account_deletion': 
        return `${baseClass} users-table-action-delete`;
      case 'other': 
        return `${baseClass} users-table-action-other`;
      default: 
        return baseClass;
    }
  };

  const handleActionClick = async (requestType: string) => {
    await onRequestAction(user, requestType);
    // Убрана старая логика с onBlockUser - теперь все через модалку техподдержки
  };

  const renderButtonWithBadge = (
    requestType: string,
    icon: string
  ) => {
    const requestCount = getRequestCount(user, requestType);
    
    return (
      <button
        onClick={() => handleActionClick(requestType)}
        className={getRequestButtonClass(requestType)}
        title={getButtonTitle(user, requestType)}
        disabled={isLoading}
      >
        {icon}
        {requestCount > 0 && (
          <span className="users-table-request-badge-small">{requestCount}</span>
        )}
      </button>
    );
  };

  return (
    <div className="users-table-actions-compact">
      {renderButtonWithBadge('password_reset', getRequestTypeIcon('password_reset'))}
      {renderButtonWithBadge('email_change', getRequestTypeIcon('email_change'))}
      {renderButtonWithBadge('unblock', getRequestTypeIcon('unblock'))}
      {renderButtonWithBadge('account_deletion', getRequestTypeIcon('account_deletion'))}
      {renderButtonWithBadge('other', getRequestTypeIcon('other'))}
    </div>
  );
};

UserActionsCell.displayName = 'UserActionsCell';
export default UserActionsCell;