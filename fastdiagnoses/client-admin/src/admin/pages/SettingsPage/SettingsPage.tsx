import React from 'react';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  return (
    <div className="admin-settings-page">
      <div className="admin-settings-page-header">
        <h2 className="admin-settings-page-title">Настройки системы</h2>
        <p className="admin-settings-page-subtitle">
          Конфигурация параметров системы и безопасности
        </p>
      </div>
      
      <div className="admin-settings-page-content">
        <div className="admin-settings-page-placeholder">
          <div className="admin-settings-page-placeholder-icon">⚙️</div>
          <h3 className="admin-settings-page-placeholder-title">
            Настройки в разработке
          </h3>
          <p className="admin-settings-page-placeholder-description">
            Панель настроек системы находится в разработке.
            Здесь будут доступны параметры безопасности, уведомлений и конфигурации системы.
          </p>
          <div className="admin-settings-page-placeholder-features">
            <div className="admin-settings-page-feature">
              <div className="admin-settings-page-feature-icon">🔒</div>
              <div className="admin-settings-page-feature-text">Безопасность</div>
            </div>
            <div className="admin-settings-page-feature">
              <div className="admin-settings-page-feature-icon">📧</div>
              <div className="admin-settings-page-feature-text">Уведомления</div>
            </div>
            <div className="admin-settings-page-feature">
              <div className="admin-settings-page-feature-icon">💾</div>
              <div className="admin-settings-page-feature-text">Хранилище</div>
            </div>
            <div className="admin-settings-page-feature">
              <div className="admin-settings-page-feature-icon">⚡</div>
              <div className="admin-settings-page-feature-text">Производительность</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

SettingsPage.displayName = 'SettingsPage';
export default SettingsPage;