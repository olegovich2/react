import React from 'react';
import './UsersStats.css';

interface UsersStatsProps {
  stats: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    blockedUsers: number;
    notBlockedUsers: number;
    usersWithRequests: number;
    usersWithOverdueRequests: number;
  };
}

const UsersStats: React.FC<UsersStatsProps> = ({ stats }) => {
  console.log('UsersStats render');
  
  return (
    <div className="users-stats-grid">
      <div className="users-stat-card users-stat-total">
        <div className="users-stat-icon">👥</div>
        <div className="users-stat-content">
          <h3 className="users-stat-value">{stats.totalUsers}</h3>
          <p className="users-stat-label">Всего пользователей</p>
        </div>
      </div>
      
      <div className="users-stat-card users-stat-active">
        <div className="users-stat-icon">✅</div>
        <div className="users-stat-content">
          <h3 className="users-stat-value">{stats.activeUsers}</h3>
          <p className="users-stat-label">Активных</p>
        </div>
      </div>
      
      <div className="users-stat-card users-stat-pending">
        <div className="users-stat-icon">⏳</div>
        <div className="users-stat-content">
          <h3 className="users-stat-value">{stats.pendingUsers}</h3>
          <p className="users-stat-label">Ожидают активации</p>
        </div>
      </div>
      
      <div className="users-stat-card users-stat-blocked">
        <div className="users-stat-icon">🔒</div>
        <div className="users-stat-content">
          <h3 className="users-stat-value">{stats.blockedUsers}</h3>
          <p className="users-stat-label">Заблокировано</p>
        </div>
      </div>
      
      <div className="users-stat-card users-stat-requests">
        <div className="users-stat-icon">📩</div>
        <div className="users-stat-content">
          <h3 className="users-stat-value">{stats.usersWithRequests}</h3>
          <p className="users-stat-label">С запросами</p>
        </div>
      </div>
      
      <div className="users-stat-card users-stat-overdue">
        <div className="users-stat-icon">⚠️</div>
        <div className="users-stat-content">
          <h3 className="users-stat-value">{stats.usersWithOverdueRequests}</h3>
          <p className="users-stat-label">Просроченные</p>
        </div>
      </div>
    </div>
  );
};

UsersStats.displayName = 'UsersStats';
export default UsersStats;