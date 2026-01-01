import React from 'react';
import { User } from '../../../../types';
import UserActionsCell from './UserActionsCell';
import './UsersTable.css';

interface UserMobileCardProps {
  user: User;
  isLoading: boolean;
  formatDate: (date: string) => string;
  formatBlockInfo: (user: User) => string | null;
  onRequestAction: (user: User, requestType: string) => Promise<User | null>;
  onResetPassword: (user: User) => Promise<void>;
}


// Функция для получения иконки статуса
const getStatusIcon = (user: User): string => {
  if (!user.isActive) return '❌';
  if (user.isBlocked) {
    return user.isPermanentlyBlocked ? '🔐' : '🔒';
  }
  return '✅';
};

// Функция для получения текста статуса
const getStatusText = (user: User): string => {
  if (!user.isActive) return 'Неактивен';
  if (user.isBlocked) {
    return user.isPermanentlyBlocked ? 'Заблокирован (бессрочно)' : 'Заблокирован';
  }
  return 'Активен';
};

// Функция для получения класса статуса
const getStatusClass = (user: User): string => {
  if (!user.isActive) return 'inactive';
  if (user.isBlocked) {
    return user.isPermanentlyBlocked ? 'permanently-blocked' : 'blocked';
  }
  return 'active';
};

// Функция для форматирования даты блокировки
const formatBlockDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateString;
  }
};

// Безопасное получение количества запросов
const getRequestCount = (user: User, type: string): number => {
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

// Безопасное получение общего количества
const getTotalRequestsSafe = (user: User): number => {
  return user.supportRequests?.total || 0;
};

// Безопасная проверка просроченных
const hasOverdueRequestsSafe = (user: User): boolean => {
  return user.supportRequests?.overdue || false;
};

const UserMobileCard: React.FC<UserMobileCardProps> = ({
  user,
  isLoading,
  formatDate,
  onRequestAction,
  onResetPassword
}) => {
  const hasOverdue = hasOverdueRequestsSafe(user);
  const statusClass = getStatusClass(user);
  const statusIcon = getStatusIcon(user);
  const statusText = getStatusText(user);
  const totalRequests = getTotalRequestsSafe(user);
  
  // Безопасные значения для блокировки
  const isBlocked = user.isBlocked || false;
  const isPermanentlyBlocked = user.isPermanentlyBlocked || false;
  const blockedUntilFormatted = user.blockedUntilFormatted || null;
  const daysRemaining = user.daysRemaining !== undefined ? user.daysRemaining : null;

  return (
    <div className={`users-table-mobile-card ${hasOverdue ? 'row-overdue' : ''}`}>
      {/* Шапка карточки (БЕЗ действий) */}
      <div className="users-table-mobile-header">
        <div className="users-table-mobile-user">
          <div className="users-table-mobile-login">
            {user.login}
            <span style={{
              fontSize: '12px',
              color: '#666',
              background: '#f1f3f4',
              padding: '2px 6px',
              borderRadius: '4px',
              marginLeft: '8px',
              fontFamily: "'Courier New', monospace"
            }}>
              ID: {user.id}
            </span>
          </div>
          <div className="users-table-mobile-email">
            <span>✉️</span>
            <span>{user.email}</span>
          </div>
        </div>
      </div>

      {/* Мета-информация */}
      <div className="users-table-mobile-meta">
        <span className={`users-table-status-badge ${statusClass}`}>
          <span>{statusIcon}</span>
          <span>{statusText}</span>
        </span>
        
        <span className="users-table-user-meta-item">
          <span className="users-table-user-meta-icon">📅</span>
          <span>{formatDate(user.createdAt)}</span>
        </span>
        
        {user.activeSessions > 0 && (
          <span className="users-table-user-meta-item">
            <span className="users-table-user-meta-icon">💻</span>
            <span>{user.activeSessions} сессий</span>
          </span>
        )}
        
        {totalRequests > 0 && (
          <span className="users-table-user-meta-item" style={{ background: '#4a6cf7', color: 'white' }}>
            <span className="users-table-user-meta-icon">📩</span>
            <span>{totalRequests} запросов</span>
          </span>
        )}
      </div>

      {/* Данные пользователя */}
      <div className="users-table-mobile-section">
        <div className="users-table-mobile-section-title">
          <span>📊</span>
          <span>Данные</span>
        </div>
        <div className="users-table-mobile-data-grid">
          <div className="users-table-mobile-data-item">
            <span className="users-table-mobile-data-label">Опросы</span>
            <span className="users-table-mobile-data-value">{user.stats?.surveys || 0}</span>
          </div>
          <div className="users-table-mobile-data-item">
            <span className="users-table-mobile-data-label">Изображения</span>
            <span className="users-table-mobile-data-value">{user.stats?.images || 0}</span>
          </div>
        </div>
      </div>

      {/* Информация о блокировке (если есть) */}
      {isBlocked && (
        <div className="users-table-mobile-section">
          <div className="users-table-mobile-section-title">
            <span>🔒</span>
            <span>Блокировка</span>
          </div>
          <div className="users-table-mobile-data-grid">
            <div className="users-table-mobile-data-item">
              <span className="users-table-mobile-data-label">Тип</span>
              <span className="users-table-mobile-data-value">
                {isPermanentlyBlocked ? 'Бессрочная' : 'Временная'}
              </span>
            </div>
            
            {blockedUntilFormatted && !isPermanentlyBlocked && (
              <div className="users-table-mobile-data-item">
                <span className="users-table-mobile-data-label">До</span>
                <span className="users-table-mobile-data-value">
                  {formatBlockDate(blockedUntilFormatted)}
                </span>
              </div>
            )}
            
            {daysRemaining !== null && daysRemaining !== undefined && daysRemaining > 0 && (
              <div className="users-table-mobile-data-item">
                <span className="users-table-mobile-data-label">Осталось</span>
                <span className="users-table-mobile-data-value">
                  {daysRemaining} дней
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Запросы техподдержки (если есть) */}
      {totalRequests > 0 && user.supportRequests && (
        <div className="users-table-mobile-section">
          <div className="users-table-mobile-section-title">
            <span>📩</span>
            <span>Запросы техподдержки</span>
            {hasOverdue && <span style={{ color: '#ff6b6b', marginLeft: '8px' }}>⚠️ Просрочены</span>}
          </div>
          <div className="users-table-mobile-requests">
            {getRequestCount(user, 'password_reset') > 0 && (
              <div className="users-table-request-item">
                <span className="users-table-request-icon">🔑</span>
                <span>Сброс пароля:</span>
                <span className="users-table-request-count">
                  {getRequestCount(user, 'password_reset')}
                </span>
              </div>
            )}
            {getRequestCount(user, 'email_change') > 0 && (
              <div className="users-table-request-item">
                <span className="users-table-request-icon">✉️</span>
                <span>Смена email:</span>
                <span className="users-table-request-count">
                  {getRequestCount(user, 'email_change')}
                </span>
              </div>
            )}
            {getRequestCount(user, 'unblock') > 0 && (
              <div className="users-table-request-item">
                <span className="users-table-request-icon">🔓</span>
                <span>Разблокировка:</span>
                <span className="users-table-request-count">
                  {getRequestCount(user, 'unblock')}
                </span>
              </div>
            )}
            {getRequestCount(user, 'account_deletion') > 0 && (
              <div className="users-table-request-item">
                <span className="users-table-request-icon">🗑️</span>
                <span>Удаление:</span>
                <span className="users-table-request-count">
                  {getRequestCount(user, 'account_deletion')}
                </span>
              </div>
            )}
            {getRequestCount(user, 'other') > 0 && (
              <div className="users-table-request-item">
                <span className="users-table-request-icon">❓</span>
                <span>Другие:</span>
                <span className="users-table-request-count">
                  {getRequestCount(user, 'other')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ДЕЙСТВИЯ ВНИЗУ КАРТОЧКИ */}
      <div className="users-table-mobile-actions-bottom">
        <div className="users-table-mobile-actions-title">
          <span>⚡</span>
          <span>Действия</span>
        </div>
        <UserActionsCell
          user={user}
          isLoading={isLoading}
          onRequestAction={onRequestAction}
          onResetPassword={onResetPassword}
        />
      </div>
    </div>
  );
};

UserMobileCard.displayName = 'UserMobileCard';
export default UserMobileCard;