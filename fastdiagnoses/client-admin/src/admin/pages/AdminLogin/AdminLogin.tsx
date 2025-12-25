import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import './AdminLogin.css';

const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, error } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    
    setIsLoading(true);
    const result = await login(username, password);
    
    if (result.success) {
      navigate('/admin');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h1 className="admin-login-title">FastDiagnoses</h1>
          <p className="admin-login-subtitle">Административная панель</p>
        </div>
        
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-login-fields">
            <div className="admin-login-input-group">
              <label htmlFor="username" className="admin-login-label">
                Логин администратора
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="admin-login-input"
                placeholder="Введите логин"
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            
            <div className="admin-login-input-group">
              <label htmlFor="password" className="admin-login-label">
                Пароль
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-login-input"
                placeholder="Введите пароль"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            
            {error && (
              <div className="admin-login-error">
                <div className="admin-login-error-icon">⚠️</div>
                <div className="admin-login-error-text">{error}</div>
              </div>
            )}
          </div>
          
          <div className="admin-login-actions">
            <button 
              type="submit" 
              className={`admin-login-button ${isLoading ? 'admin-login-button-disabled' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="admin-login-loading">
                  <span>Вход...</span>
                  <div className="admin-login-spinner"></div>
                </div>
              ) : (
                'Войти в панель управления'
              )}
            </button>
          </div>
          
          <div className="admin-login-info">
            <p className="admin-login-info-text">Тестовые данные:</p>
            <p className="admin-login-info-text">
              Логин: <strong>admin</strong>
            </p>
            <p className="admin-login-info-text">
              Пароль: <strong>admin123</strong>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

AdminLogin.displayName = 'AdminLogin';
export default AdminLogin;