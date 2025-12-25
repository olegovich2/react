import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../../hooks/useAdminAuth';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const menuItems = [
    { path: '/admin/', label: 'Дашборд', icon: '📊' },
    { path: '/admin/users', label: 'Пользователи', icon: '👥' },
    { path: '/admin/logs', label: 'Логи системы', icon: '📋' },
    { path: '/admin/settings', label: 'Настройки', icon: '⚙️' },
    { path: '/admin/backups', label: 'Бэкапы', icon: '💾' },
  ];

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-logo">
        <div className="admin-sidebar-logo-icon">⚕️</div>
        <h2 className="admin-sidebar-logo-text">FastDiagnoses</h2>
        <p className="admin-sidebar-logo-subtext">Админ-панель</p>
      </div>
      
      <nav className="admin-sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin/'} // ВАЖНО: end для точного совпадения
            className={({ isActive }) => 
              `admin-sidebar-nav-link ${isActive ? 'admin-sidebar-nav-link-active' : ''}`
            }
          >
            <span className="admin-sidebar-nav-icon">{item.icon}</span>
            <span className="admin-sidebar-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="admin-sidebar-footer">
        <button 
          onClick={handleLogout}
          className="admin-sidebar-logout-button"
        >
          <span className="admin-sidebar-logout-icon">🚪</span>
          <span className="admin-sidebar-logout-text">Выйти</span>
        </button>
      </div>
    </aside>
  );
};

Sidebar.displayName = 'Sidebar';
export default Sidebar;