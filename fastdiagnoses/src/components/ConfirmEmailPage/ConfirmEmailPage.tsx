
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { confirmEmail } from '../../api/confirm.api';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';

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
    <div className="general">
      <Header/>
      <main className="main">
        <div className="auth-form-container">
          <div className="auth-header">
            <h3>Подтверждение Email</h3>
          </div>
          
          {status === 'loading' && (
            <div className="loading-message">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Подтверждение email...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="success-message">
              <i className="fas fa-check-circle"></i>
              <h4>Успешно!</h4>
              <p>{message}</p>
              <p>Вы будете перенаправлены на страницу входа...</p>
              <button 
                className="buttonFromTemplate" 
                onClick={() => navigate('/login')}
              >
                Перейти к входу
              </button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              <h4>Ошибка</h4>
              <p>{message}</p>
              <div className="action-buttons">
                <button 
                  className="buttonFromTemplate" 
                  onClick={() => navigate('/register')}
                >
                  Зарегистрироваться снова
                </button>
                <button 
                  className="buttonFromTemplate secondary" 
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

export default ConfirmEmailPage;