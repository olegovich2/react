import React, { useEffect } from 'react';
import { useAdminAuth } from '../../../../hooks/useAdminAuth';
import './Header.css';

const Header: React.FC = () => {
  const { user } = useAdminAuth();
  
  useEffect(() => {
    console.log('👤 [Header] Пользователь в Header:', {
      username: user?.username,
      role: user?.role,
      hasUser: !!user
    });
  }, [user]);
  
  const currentTime = new Date().toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  const currentDate = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <div className="admin-header-welcome">
          <h1 className="admin-header-title">Панель управления</h1>
          <p className="admin-header-subtitle">
            Добро пожаловать, <strong>{user?.username || 'Администратор'}</strong>
          </p>
        </div>
      </div>
      
      <div className="admin-header-right">
        <div className="admin-header-time">
          <div className="admin-header-clock">🕒</div>
          <div className="admin-header-time-info">
            <div className="admin-header-current-time">{currentTime}</div>
            <div className="admin-header-current-date">{currentDate}</div>
          </div>
        </div>
        
        <div className="admin-header-user">
          <div className="admin-header-user-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="admin-header-user-info">
            <div className="admin-header-user-name">{user?.username || 'Администратор'}</div>
            <div className="admin-header-user-role">
              {user?.role === 'admin' ? 'Администратор' : 'Модератор'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

Header.displayName = 'Header';
export default Header;