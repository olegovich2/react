import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import LoginForm from './LoginForm/LoginForm';
import { useAccountStorage } from '../../services/index';
import './LoginPage.css'; 

const LoginPage: React.FC = () => {
  const { clearOnlyAccountStorage } = useAccountStorage();
  
  const location = useLocation();
  const navigate = useNavigate();
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

useEffect(() => {
    console.log('🔑 Загружена страница логина - очищаем ключи аккаунта');
    clearOnlyAccountStorage();
  }, [clearOnlyAccountStorage]);

  useEffect(() => {
    // Проверяем параметры URL
    const searchParams = new URLSearchParams(location.search);
    const changed = searchParams.get('passwordChanged') === 'true';
    const sent = searchParams.get('emailSent') === 'true';
    
    if (changed) {
      setPasswordChanged(true);
      setEmailSent(sent);
      
      // Очищаем URL от параметров (чтобы при обновлении страницы баннер не показывался снова)
      navigate(location.pathname, { replace: true });
      
      // Автоматически скрываем сообщение через 30 секунд
      const timer = setTimeout(() => {
        setPasswordChanged(false);
        setEmailSent(false);
      }, 30000);
      
      return () => clearTimeout(timer);
    }
  }, [location, navigate]);

  const handleLoginSuccess = () => {
    console.log('Вход выполнен успешно');
  };

  const handleLoginError = (message: string) => {
    console.error('Ошибка входа:', message);
  };

  const handleCloseBanner = () => {
    setPasswordChanged(false);
    setEmailSent(false);
  };

  return (
    <div className="login-page-container">
      <Header/>
      
      <main className="login-page-main-content">
        {/* Баннер с информацией об изменении пароля */}
        {passwordChanged && (
          <div className="login-page-password-change-banner">
            <div className="login-page-banner-icon">🔐</div>
            <div className="login-page-banner-content">
              <h3>Пароль успешно изменен!</h3>
              <p>
                {emailSent 
                  ? '📧 На вашу почту отправлено уведомление. Введите НОВЫЙ пароль в поле ниже.'
                  : 'Введите НОВЫЙ пароль в поле ниже.'}
              </p>
              <div className="login-page-banner-instructions">
                <p><strong>Что делать:</strong></p>
                <ol>
                  <li>Введите новый пароль (старый больше не работает)</li>
                  <li>Сохраните пароль в менеджере паролей</li>
                </ol>
              </div>
            </div>
            <button 
              className="login-page-banner-close"
              onClick={handleCloseBanner}
              aria-label="Закрыть сообщение"
            >
              ✕
            </button>
          </div>
        )}

        <div className="login-page-form-wrapper">
          <LoginForm 
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            redirectOnSuccess={true}
          />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

LoginPage.displayName = 'LoginPage';

export default LoginPage;