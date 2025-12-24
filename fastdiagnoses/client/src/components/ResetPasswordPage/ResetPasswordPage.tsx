import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import { loginAPI } from '../../api/login.api';
import './ResetPasswordPage.css';

const ResetPasswordPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setMessage('Ссылка восстановления не содержит токена');
        setIsTokenValid(false);
        setValidating(false);
        return;
      }

      try {
        console.log('🔍 Проверка токена восстановления:', token);
        const response = await loginAPI.validateResetToken(token);
        
        console.log('📊 Ответ проверки токена:', response);
        
        if (response.success && response.valid) {
          setIsTokenValid(true);
          setUserEmail(response.email || '');
          setMessage('');
        } else {
          setIsTokenValid(false);
          setMessage(response.message || 'Токен недействителен');
        }
      } catch (error: any) {
        console.error('❌ Ошибка проверки токена:', error);
        setIsTokenValid(false);
        setMessage('Ошибка проверки токена. Попробуйте позже.');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!newPassword) {
      newErrors.newPassword = 'Введите новый пароль';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Пароль должен быть не менее 6 символов';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Подтвердите пароль';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      console.log('🔐 Установка нового пароля для токена:', token);
      
      const response = await loginAPI.resetPassword(
        token!,
        newPassword,
        confirmPassword
      );
      
      console.log('📊 Ответ установки пароля:', response);
      
      if (response.success) {
        setMessage('✅ Пароль успешно изменен! Вы будете перенаправлены на страницу входа...');
        
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              passwordChanged: true,
              emailSent: true 
            }
          });
        }, 3000);
      } else {
        setMessage(`❌ ${response.message || 'Ошибка изменения пароля'}`);
      }
    } catch (error: any) {
      console.error('❌ Ошибка при установке пароля:', error);
      setMessage('Ошибка соединения с сервером. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  // Если проверяем токен
  if (validating) {
    return (
      <div className="reset-pass-container">
        <Header />
        <main className="reset-pass-main">
          <div className="reset-pass-card">
            <div className="reset-pass-loading">
              <div className="reset-pass-spinner"></div>
              <p>Проверка ссылки восстановления...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Если токен невалиден
  if (!isTokenValid) {
    return (
      <div className="reset-pass-container">
        <Header />
        <main className="reset-pass-main">
          <div className="reset-pass-card">
            <div className="reset-pass-invalid">
              <h1>
                <i className="fas fa-exclamation-triangle"></i> Ссылка недействительна
              </h1>
              <p className="reset-pass-error-message">{message || 'Ссылка для восстановления пароля устарела или неверна.'}</p>
              <div className="reset-pass-suggestions">
                <p><strong>Возможные причины:</strong></p>
                <ul>
                  <li>Ссылка действительна только 1 час</li>
                  <li>Ссылка уже была использована</li>
                  <li>Неверная или поврежденная ссылка</li>
                </ul>
              </div>
              <div className="reset-pass-actions">
                <Link to="/forgot-password" className="reset-pass-retry-btn">
                  <i className="fas fa-redo"></i> Запросить новую ссылку
                </Link>
                <Link to="/login" className="reset-pass-login-btn">
                  <i className="fas fa-sign-in-alt"></i> Вернуться ко входу
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Форма установки нового пароля
  return (
    <div className="reset-pass-container">
      <Header />
      
      <main className="reset-pass-main">
        <div className="reset-pass-card">
          <div className="reset-pass-header">
            <h1>
              <i className="fas fa-lock"></i> Установка нового пароля
            </h1>
            <p className="reset-pass-subtitle">
              Для аккаунта: <strong>{userEmail}</strong>
            </p>
            <p className="reset-pass-instruction">
              Придумайте новый пароль для вашего аккаунта
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="reset-pass-form">
            <div className="reset-pass-form-group">
              <label htmlFor="reset-pass-new-password">
                <i className="fas fa-key"></i> Новый пароль:
              </label>
              <input
                id="reset-pass-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Введите новый пароль"
                className={errors.newPassword ? 'reset-pass-input-error' : 'reset-pass-input'}
                disabled={loading}
                autoFocus
              />
              {errors.newPassword && (
                <div className="reset-pass-error-message">
                  <i className="fas fa-exclamation-circle"></i> {errors.newPassword}
                </div>
              )}
              <div className="reset-pass-hint">
                Пароль должен содержать не менее 6 символов
              </div>
            </div>
            
            <div className="reset-pass-form-group">
              <label htmlFor="reset-pass-confirm-password">
                <i className="fas fa-key"></i> Подтвердите пароль:
              </label>
              <input
                id="reset-pass-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                className={errors.confirmPassword ? 'reset-pass-input-error' : 'reset-pass-input'}
                disabled={loading}
              />
              {errors.confirmPassword && (
                <div className="reset-pass-error-message">
                  <i className="fas fa-exclamation-circle"></i> {errors.confirmPassword}
                </div>
              )}
            </div>
            
            <div className="reset-pass-form-actions">
              <button 
                type="submit" 
                className="reset-pass-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Установка...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle"></i> Установить новый пароль
                  </>
                )}
              </button>
              
              <Link to="/login" className="reset-pass-cancel-btn">
                <i className="fas fa-times"></i> Отмена
              </Link>
            </div>
          </form>
          
          {message && (
            <div className={`reset-pass-message ${message.includes('✅') ? 'reset-pass-success' : 'reset-pass-error'}`}>
              <div className="reset-pass-message-icon">
                {message.includes('✅') ? '✅' : '⚠️'}
              </div>
              <div className="reset-pass-message-text">
                <p>{message}</p>
                {message.includes('✅') && (
                  <div className="reset-pass-redirect">
                    <p>Автоматический переход через 3 секунды...</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="reset-pass-security">
            <p>
              <i className="fas fa-shield-alt"></i>
              {' '}
              После установки нового пароля все активные сессии будут завершены
              в целях безопасности.
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

ResetPasswordPage.displayName = 'ResetPasswordPage';

export default ResetPasswordPage;