import React from 'react';
import './UsersPage.css';

const UsersPage: React.FC = () => {
  return (
    <div className="admin-users-page">
      <div className="admin-users-page-header">
        <h2 className="admin-users-page-title">Управление пользователями</h2>
        <p className="admin-users-page-subtitle">
          Просмотр и управление пользователями системы
        </p>
      </div>
      
      <div className="admin-users-page-content">
        <div className="admin-users-page-placeholder">
          <div className="admin-users-page-placeholder-icon">👥</div>
          <h3 className="admin-users-page-placeholder-title">
            Страница в разработке
          </h3>
          <p className="admin-users-page-placeholder-description">
            В данный момент страница управления пользователями находится в разработке.
            Здесь будут доступны функции просмотра, редактирования и удаления пользователей.
          </p>
          <div className="admin-users-page-placeholder-stats">
            <div className="admin-users-page-stat">
              <div className="admin-users-page-stat-value">0</div>
              <div className="admin-users-page-stat-label">Пользователей</div>
            </div>
            <div className="admin-users-page-stat">
              <div className="admin-users-page-stat-value">0</div>
              <div className="admin-users-page-stat-label">Активных</div>
            </div>
            <div className="admin-users-page-stat">
              <div className="admin-users-page-stat-value">0</div>
              <div className="admin-users-page-stat-label">Заблокированных</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

UsersPage.displayName = 'UsersPage';
export default UsersPage;