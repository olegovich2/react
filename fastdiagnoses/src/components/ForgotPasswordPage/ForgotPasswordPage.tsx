import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import { loginAPI } from '../../api/login.api';
import './ForgotPasswordPage.css';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [userEmail, setUserEmail] = useState(''); // ← ДОБАВЛЕНО: сохраняем email для кнопки
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setUserEmail(''); // Сбрасываем сохраненный email
    
    // Простая валидация email
    if (!email || !email.includes('@')) {
      setError('Введите корректный email адрес');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('📧 Отправка запроса на восстановление для:', email);
      
      const response = await loginAPI.forgotPassword(email.trim());
      
      console.log('📊 Ответ от сервера:', response);
      
      if (response.success) {
        setIsSuccess(true);
        setUserEmail(email.trim()); // ← СОХРАНЯЕМ email для кнопки
        setMessage('Инструкции по восстановлению пароля отправлены на указанный email');
        
        // Очищаем поле ввода
        setEmail('');
        
        // Автоочистка сообщения через 10 секунд
        setTimeout(() => {
          setMessage('');
          setIsSuccess(false);
          setUserEmail('');
        }, 10000);
      } else {
        setError(response.message || 'Произошла ошибка');
      }
    } catch (err: any) {
      console.error('❌ Ошибка при восстановлении пароля:', err);
      setError('Ошибка соединения с сервером. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  const handleGoToEmail = (emailToUse: string) => {
    // Извлекаем домен из email
    const domain = emailToUse.split('@')[1]?.toLowerCase();
    const emailProviders: Record<string, string> = {
      'gmail.com': 'https://mail.google.com',
      'yandex.ru': 'https://mail.yandex.ru',
      'yandex.com': 'https://mail.yandex.com',
      'mail.ru': 'https://mail.ru',
      'bk.ru': 'https://mail.ru',
      'list.ru': 'https://mail.ru',
      'inbox.ru': 'https://mail.ru',
      'outlook.com': 'https://outlook.live.com',
      'hotmail.com': 'https://outlook.live.com',
      'yahoo.com': 'https://mail.yahoo.com',
      'rambler.ru': 'https://mail.rambler.ru'
    };
    
    // Добавляем протокол если его нет
    let url = emailProviders[domain];
    if (!url) {
      // Пытаемся угадать URL почтового сервиса
      if (domain && !domain.includes('.')) {
        url = `https://mail.${domain}.com`;
      } else if (domain) {
        url = `https://${domain}`;
      } else {
        url = 'https://mail.google.com'; // fallback
      }
    }
    
    console.log('📧 Переход на почту:', url);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="forgot-pass-container">
      <Header />
      
      <main className="forgot-pass-main">
        <div className="forgot-pass-card">
          <div className="forgot-pass-header">
            <h1>
              <i className="fas fa-key"></i> Восстановление пароля
            </h1>
            <p className="forgot-pass-subtitle">
              Введите ваш email, и мы отправим инструкции для восстановления пароля
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="forgot-pass-form">
            <div className="forgot-pass-form-group">
              <label htmlFor="forgot-pass-email">Email адрес:</label>
              <input
                id="forgot-pass-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className={error ? 'forgot-pass-input-error' : 'forgot-pass-input'}
                disabled={loading}
                required
              />
              {error && <div className="forgot-pass-error-message">{error}</div>}
            </div>
            
            <div className="forgot-pass-form-actions">
              <button 
                type="submit" 
                className="forgot-pass-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Отправка...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane"></i> Отправить инструкции
                  </>
                )}
              </button>
              
              <button 
                type="button" 
                className="forgot-pass-back-btn"
                onClick={handleBackToLogin}
                disabled={loading}
              >
                <i className="fas fa-arrow-left"></i> Назад к входу
              </button>
            </div>
          </form>
          
          {message && (
            <div className={`forgot-pass-message ${isSuccess ? 'forgot-pass-success' : 'forgot-pass-error'}`}>
              <div className="forgot-pass-message-icon">
                {isSuccess ? '✅' : '⚠️'}
              </div>
              <div className="forgot-pass-message-text">
                <strong>{isSuccess ? 'Успешно!' : 'Ошибка!'}</strong>
                <p>{message}</p>
                {isSuccess && userEmail && (
                  <div className="forgot-pass-instructions">
                    <p><strong>Что делать дальше:</strong></p>
                    <ol>
                      <li>Проверьте папку "Входящие" вашего email</li>
                      <li>Если письма нет, проверьте "Спам"</li>
                      <li>Перейдите по ссылке в письме</li>
                      <li>Установите новый пароль</li>
                    </ol>
                    
                    {/* ВАЖНО: Кнопка теперь всегда видна при успехе */}
                    <button 
                      className="forgot-pass-email-btn"
                      onClick={() => handleGoToEmail(userEmail)}
                      type="button"
                    >
                      <i className="fas fa-external-link-alt"></i> Перейти на электронную почту
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="forgot-pass-help-info">
            <p>
              <i className="fas fa-info-circle"></i>
              {' '}
              Ссылка для восстановления будет активна 1 час.
              Если письмо не пришло в течение 5 минут, проверьте папку "Спам".
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

ForgotPasswordPage.displayName = 'ForgotPasswordPage';

export default ForgotPasswordPage;