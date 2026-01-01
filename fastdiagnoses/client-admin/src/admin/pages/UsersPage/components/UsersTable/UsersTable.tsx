import React from 'react';
import { User } from '../../../../types';
import UserTableRow from './UserTableRow';
import UserMobileCard from './UserMobileCard';
import './UsersTable.css';

interface UsersTableProps {
  users: User[];
  isLoading: boolean;
  onRequestAction: (user: User, requestType: string) => Promise<User | null>;
  onResetPassword: (user: User) => Promise<void>;
}

const UsersTable: React.FC<UsersTableProps> = ({
  users,
  isLoading,
  onRequestAction,
  onResetPassword
}) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatBlockInfo = (user: User) => {
    if (!user.isBlocked) return null;
    
    if (user.isPermanentlyBlocked) {
      return 'Бессрочно';
    }
    
    if (user.blockedUntilFormatted) {
      return user.blockedUntilFormatted;
    }
    
    return 'Дата неизвестна';
  };

  return (
    <div className="users-table-container">
      {/* Десктопная таблица (скрывается на мобильных) */}
      <table className="users-table users-table-desktop">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>Данные</th>
            <th>Запросы</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserTableRow
              key={user.id}
              user={user}
              isLoading={isLoading}
              formatDate={formatDate}
              formatBlockInfo={formatBlockInfo}
              onRequestAction={onRequestAction}
              onResetPassword={onResetPassword}
            />
          ))}
        </tbody>
      </table>

      {/* Мобильные карточки (скрываются на десктопе) */}
      <div className="users-table-mobile">
        {users.map((user) => (
          <UserMobileCard
            key={user.id}
            user={user}
            isLoading={isLoading}
            formatDate={formatDate}
            formatBlockInfo={formatBlockInfo}
            onRequestAction={onRequestAction}
            onResetPassword={onResetPassword}
          />
        ))}
      </div>
    </div>
  );
};

UsersTable.displayName = 'UsersTable';
export default UsersTable;