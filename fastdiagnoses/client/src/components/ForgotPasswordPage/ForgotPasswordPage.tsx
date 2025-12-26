import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import { loginAPI } from '../../api/login.api';
import './ForgotPasswordPage.css';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [secretWord, setSecretWord] = useState(''); // ← ДОБАВЛЕНО: кодовое слово
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({}); // ← ДОБАВЛЕНО: ошибки полей

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const lettersOnlyRegex = /^[а-яёА-ЯЁa-zA-Z]+$/;

    // Валидация email
    if (!email || !email.includes('@')) {
      newErrors.email = 'Введите корректный email адрес';
    }

    // Валидация кодового слова
    if (!secretWord.trim()) {
      newErrors.secretWord = 'Кодовое слово обязательно';
    } else if (secretWord.length < 3) {
      newErrors.secretWord = 'Кодовое слово должно быть минимум 3 символа';
    } else if (secretWord.length > 50) {
      newErrors.secretWord = 'Кодовое слово должно быть максимум 50 символов';
    } else if (!lettersOnlyRegex.test(secretWord)) {
      newErrors.secretWord = 'Только буквы (русские или английские), без цифр и спецсимволов';
    } else if (/<[^>]*>|javascript:|on\w+\s*=/.test(secretWord.toLowerCase())) {
      newErrors.secretWord = 'Недопустимые символы в кодовом слове';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    if (field === 'email') {
      setEmail(value);
    } else if (field === 'secretWord') {
      setSecretWord(value);
    }
    
    // Очищаем ошибку при изменении поля
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setUserEmail('');
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('📧 Отправка запроса на восстановление для:', email);
      
      // TODO: Нужно обновить API метод для поддержки кодового слова
      // Пока используем существующий метод
      const response = await loginAPI.forgotPassword(email.trim(), secretWord);
      
      console.log('📊 Ответ от сервера:', response);
      
      if (response.success) {
        setIsSuccess(true);
        setUserEmail(email.trim());
        setMessage('Инструкции по восстановлению пароля отправлены на указанный email');
        
        // Очищаем поля ввода
        setEmail('');
        setSecretWord('');
        
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

  const handleSupportClick = () => {
    navigate('/support');
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
    
    let url = emailProviders[domain];
    if (!url) {
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
              Введите ваш email и кодовое слово для восстановления доступа
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="forgot-pass-form">
            <div className="forgot-pass-form-group">
              <label htmlFor="forgot-pass-email">
                <i className="fas fa-envelope"></i> Email адрес:
              </label>
              <input
                id="forgot-pass-email"
                type="email"
                value={email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="example@gmail.com"
                className={errors.email ? 'forgot-pass-input-error' : 'forgot-pass-input'}
                disabled={loading}
                required
              />
              {errors.email && (
                <div className="forgot-pass-field-error">
                  <i className="fas fa-exclamation-triangle"></i> {errors.email}
                </div>
              )}
            </div>
            
            <div className="forgot-pass-form-group">
              <label htmlFor="forgot-pass-secret-word">
                <i className="fas fa-key"></i> Кодовое слово:
              </label>
              <input
                id="forgot-pass-secret-word"
                type="text"
                value={secretWord}
                onChange={(e) => handleChange('secretWord', e.target.value)}
                placeholder="Введите ваше кодовое слово"
                className={errors.secretWord ? 'forgot-pass-input-error' : 'forgot-pass-input'}
                disabled={loading}
                required
              />
              <div className="forgot-pass-secret-word-info">
                <i className="fas fa-info-circle"></i>
                <span>Введите кодовое слово, которое указывали при регистрации.</span>
              </div>
              {errors.secretWord && (
                <div className="forgot-pass-field-error">
                  <i className="fas fa-exclamation-triangle"></i> {errors.secretWord}
                </div>
              )}
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
                    <i className="fas fa-paper-plane"></i> Восстановить пароль
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
          
          {error && (
            <div className="forgot-pass-error-message-global">
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}
          
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
            
            <div className="forgot-pass-support-link-container">
              <button 
                type="button" 
                className="forgot-pass-support-link"
                onClick={handleSupportClick}
              >
                <i className="fas fa-headset"></i> Техническая поддержка
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

ForgotPasswordPage.displayName = 'ForgotPasswordPage';

export default ForgotPasswordPage;