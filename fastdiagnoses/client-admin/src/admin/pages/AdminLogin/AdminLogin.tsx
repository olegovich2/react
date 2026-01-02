import React, { FormEvent, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import Loader from '../components/Loader/Loader';
import './AdminLogin.css';

const AdminLogin: React.FC = () => {
  const { state: { isAuthenticated, isLoading, error }, login } = useAdminAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  console.log('🔁 [AdminLogin] Рендер компонента');

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    
    const username = usernameRef.current?.value || '';
    const password = passwordRef.current?.value || '';
    
    if (!username.trim() || !password.trim()) {
      return;
    }
    
    const result = await login(username, password);
    
    if (usernameRef.current) usernameRef.current.value = '';
    if (passwordRef.current) passwordRef.current.value = '';
  }, [login]);

  useEffect(() => {
    if (isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    console.log('⏳ [AdminLogin] Рендер: показываем лоадер');
    return <Loader />;
  }

  if (isAuthenticated) {
    console.log('🔄 [AdminLogin] Рендер: ожидаем редирект');
    return <Loader />;
  }

  console.log('📝 [AdminLogin] Рендер: показываем форму входа');
  
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
                ref={usernameRef}
                className="admin-login-input"
                placeholder="Введите логин"
                required
                disabled={isLoading}
                autoComplete="username"
                defaultValue=""
              />
            </div>
            
            <div className="admin-login-input-group">
              <label htmlFor="password" className="admin-login-label">
                Пароль
              </label>
              <input
                type="password"
                id="password"
                ref={passwordRef}
                className="admin-login-input"
                placeholder="Введите пароль"
                required
                disabled={isLoading}
                autoComplete="current-password"
                defaultValue=""
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
              {isLoading ? 'Вход...' : 'Войти в панель управления'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

AdminLogin.displayName = 'AdminLogin';
export default AdminLogin;