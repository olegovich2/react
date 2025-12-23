import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { confirmEmail } from '../../api/confirm.api';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import './ConfirmEmailPage.css';

const ConfirmEmailPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirm = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Неверная ссылка подтверждения');
        return;
      }

      try {
        const result = await confirmEmail(token);
        if (result.success) {
          setStatus('success');
          setMessage('Email успешно подтвержден! Теперь вы можете войти в систему.');
          
          // Автопереход на страницу входа через 3 секунды
          setTimeout(() => {
            navigate('/login', { 
              state: { 
                message: 'Email успешно подтвержден. Теперь вы можете войти.' 
              } 
            });
          }, 3000);
        } else {
          setStatus('error');
          setMessage(result.message || 'Ошибка подтверждения email');
        }
      } catch (error: any) {
        setStatus('error');
        setMessage(error.message || 'Произошла ошибка');
      }
    };

    confirm();
  }, [token, navigate]);

  return (
    <div className="confirm-email-general">
      <Header/>
      <main className="confirm-email-main">
        <div className="confirm-email-container">
          <div className="confirm-email-header">
            <h3 className="confirm-email-title">Подтверждение Email</h3>
          </div>
          
          {status === 'loading' && (
            <div className="confirm-email-loading">
              <i className="fas fa-spinner fa-spin confirm-email-spinner"></i>
              <p className="confirm-email-loading-text">Подтверждение email...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="confirm-email-success">
              <i className="fas fa-check-circle confirm-email-success-icon"></i>
              <h4 className="confirm-email-success-title">Успешно!</h4>
              <p className="confirm-email-message">{message}</p>
              <p className="confirm-email-redirect">Вы будете перенаправлены на страницу входа...</p>
              <button 
                className="confirm-email-button" 
                onClick={() => navigate('/login')}
              >
                Перейти к входу
              </button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="confirm-email-error">
              <i className="fas fa-exclamation-circle confirm-email-error-icon"></i>
              <h4 className="confirm-email-error-title">Ошибка</h4>
              <p className="confirm-email-message">{message}</p>
              <div className="confirm-email-actions">
                <button 
                  className="confirm-email-button confirm-email-primary-button" 
                  onClick={() => navigate('/register')}
                >
                  Зарегистрироваться снова
                </button>
                <button 
                  className="confirm-email-button confirm-email-secondary-button" 
                  onClick={() => navigate('/login')}
                >
                  Войти
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

ConfirmEmailPage.displayName = 'ConfirmEmailPage';

export default ConfirmEmailPage;