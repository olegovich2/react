import React from 'react';
import { User } from '../../../../types';

interface UserRequestsCellProps {
  user: User;
}

// Типы запросов
type RequestType = 'password_reset' | 'email_change' | 'unblock' | 'account_deletion' | 'other';

// Вспомогательная функция для безопасного получения количества запросов
const getRequestCount = (user: User, type: RequestType): number => {
  if (!user.supportRequests) return 0;
  
  switch (type) {
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

// Функция для получения иконки для типа запроса
const getRequestTypeIcon = (type: RequestType): string => {
  switch (type) {
    case 'password_reset': return '🔑';
    case 'email_change': return '✉️';
    case 'unblock': return '🔓';
    case 'account_deletion': return '🗑️';
    case 'other': return '❓';
    default: return '📩';
  }
};

// Функция для получения всех типов запросов с ненулевым количеством
const getActiveRequestTypes = (user: User): RequestType[] => {
  const requestTypes: RequestType[] = ['password_reset', 'email_change', 'unblock', 'account_deletion', 'other'];
  
  return requestTypes.filter(type => {
    const count = getRequestCount(user, type);
    return count > 0;
  });
};

const UserRequestsCell: React.FC<UserRequestsCellProps> = ({ user }) => {
  const activeRequestTypes = getActiveRequestTypes(user);
  const hasOverdue = user.supportRequests?.overdue || false;
  const totalRequests = user.supportRequests?.total || 0;

  // Если нет активных запросов, показываем прочерк или ничего
  if (activeRequestTypes.length === 0 && !hasOverdue) {
    return (
      <div className="users-table-requests-compact">
        <span style={{ color: '#999', fontSize: '13px' }}>—</span>
      </div>
    );
  }

  return (
    <div className="users-table-requests-compact">
      {activeRequestTypes.map(type => {
        const count = getRequestCount(user, type);
        const icon = getRequestTypeIcon(type);
        const title = type === 'password_reset' ? 'Сброс пароля' :
                     type === 'email_change' ? 'Смена email' :
                     type === 'unblock' ? 'Разблокировка' :
                     type === 'account_deletion' ? 'Удаление' : 'Другое';
        
        return (
          <div 
            key={type} 
            className="users-table-request-item"
            title={`${title}: ${count} запросов`}
          >
            <span className="users-table-request-icon">{icon}</span>
            <span className="users-table-request-count">{count}</span>
          </div>
        );
      })}
      
      {hasOverdue && (
        <div 
          className="users-table-overdue-badge-small" 
          title="Есть просроченные запросы"
        >
          ⚠️
        </div>
      )}
      
      {/* Общее количество (маленький бейдж) */}
      {totalRequests > 0 && (
        <div style={{
          fontSize: '11px',
          color: '#666',
          background: '#f8f9fa',
          padding: '2px 6px',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          Всего: {totalRequests}
        </div>
      )}
    </div>
  );
};

UserRequestsCell.displayName = 'UserRequestsCell';
export default UserRequestsCell;