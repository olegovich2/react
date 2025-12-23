import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import './RegisterSuccessPage.css';

const RegisterSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState<string>('');
  const [emailDomain, setEmailDomain] = useState<string>('');

  useEffect(() => {
    // Пытаемся получить email из нескольких источников:
    // 1. Из state навигации
    // 2. Из localStorage
    // 3. Из URL параметров (если будет нужно)

    let email = '';
    
    // Источник 1: state навигации
    if (location.state && location.state.email) {
      email = location.state.email;
    }
    
    // Источник 2: localStorage (если state пустой)
    if (!email) {
      email = localStorage.getItem('pendingEmail') || '';
    }
    
    if (email) {
      setUserEmail(email);
      
      // Определяем почтовый сервис по домену
      const domain = email.split('@')[1]?.toLowerCase();
      setEmailDomain(domain || '');
      
      // Очищаем localStorage после использования (через 5 секунд)
      setTimeout(() => {
        localStorage.removeItem('pendingEmail');
        localStorage.removeItem('pendingLogin');
        localStorage.removeItem('pendingEmailTimestamp');
      }, 5000);
    }
  }, [location]);

  // Функция для определения почтового сервиса
  const getEmailProvider = (domain: string): { name: string; url: string } => {
    const providers: Record<string, { name: string; url: string }> = {
      'gmail.com': { name: 'Gmail', url: 'https://mail.google.com' },
      'yandex.ru': { name: 'Яндекс', url: 'https://mail.yandex.ru' },
      'mail.ru': { name: 'Mail.ru', url: 'https://mail.ru' },
      'bk.ru': { name: 'Mail.ru', url: 'https://mail.ru' },
      'inbox.ru': { name: 'Mail.ru', url: 'https://mail.ru' },
      'list.ru': { name: 'Mail.ru', url: 'https://mail.ru' },
      'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com' },
      'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com' },
      'live.com': { name: 'Outlook', url: 'https://outlook.live.com' },
      'yahoo.com': { name: 'Yahoo', url: 'https://mail.yahoo.com' },
      'rambler.ru': { name: 'Rambler', url: 'https://mail.rambler.ru' },
      'icloud.com': { name: 'iCloud', url: 'https://www.icloud.com/mail' },
    };

    return providers[domain] || { name: 'почтовый сервис', url: '' };
  };

  const handleOpenEmail = () => {
    if (emailDomain) {
      const provider = getEmailProvider(emailDomain);
      if (provider.url) {
        window.open(provider.url, '_blank');
      } else {
        // Если домен неизвестен, показываем общий список
        showEmailProviders();
      }
    } else {
      // Если нет email, показываем общий список
      showEmailProviders();
    }
  };

  const showEmailProviders = () => {
    const providers = [
      { name: 'Gmail', url: 'https://mail.google.com' },
      { name: 'Яндекс', url: 'https://mail.yandex.ru' },
      { name: 'Mail.ru', url: 'https://mail.ru' },
      { name: 'Outlook', url: 'https://outlook.live.com' },
      { name: 'Yahoo', url: 'https://mail.yahoo.com' },
      { name: 'Rambler', url: 'https://mail.rambler.ru' },
    ];

    const providerWindow = window.open('', '_blank');
    if (providerWindow) {
      providerWindow.document.write(`
        <html>
        <head>
          <title>Открыть почту</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              background-color: rgb(184, 198, 202);
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 10px;
              border: 2px solid rgb(88, 96, 98);
              box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
            }
            h1 {
              color: rgb(88, 96, 98);
              text-align: center;
              font-family: 'Montserrat', sans-serif;
            }
            .provider-list {
              display: flex;
              flex-direction: column;
              gap: 15px;
              margin: 20px 0;
            }
            .provider-button {
              padding: 15px;
              background: linear-gradient(135deg, rgb(183, 222, 234), rgb(144, 202, 249));
              color: rgb(88, 96, 98);
              border: 2px solid rgb(88, 96, 98);
              border-radius: 8px;
              font-size: 16px;
              font-weight: 700;
              cursor: pointer;
              transition: all 0.3s ease;
              text-align: center;
              text-decoration: none;
              display: block;
              font-family: 'Montserrat', sans-serif;
            }
            .provider-button:hover {
              background: linear-gradient(135deg, rgb(88, 96, 98), rgb(66, 73, 75));
              color: rgb(183, 222, 234);
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            .note {
              color: #718096;
              font-size: 14px;
              text-align: center;
              margin-top: 20px;
              padding: 10px;
              background: rgba(183, 222, 234, 0.2);
              border-radius: 6px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📧 Открыть почтовый сервис</h1>
            <div class="provider-list">
              ${providers.map(provider => `
                <a href="${provider.url}" target="_blank" class="provider-button">
                  Открыть ${provider.name}
                </a>
              `).join('')}
            </div>
            <div class="note">
              После открытия почтового сервиса проверьте папку "Входящие" или "Спам"
            </div>
          </div>
        </body>
        </html>
      `);
      providerWindow.document.close();
    }
  };

  return (
    <div className="reg-success-general">
      <Header/>
      <main className="reg-success-main">
        <div className="reg-success-container">
          <div className="reg-success-header">
            <h3 className="reg-success-title">Регистрация завершена!</h3>
          </div>
          
          <div className="reg-success-content">
            <i className="fas fa-check-circle reg-success-icon"></i>
            <h4 className="reg-success-subtitle">Успешная регистрация</h4>
            <p className="reg-success-message">
              Вы успешно зарегистрировались в системе QuickDiagnosis!
            </p>
            
            {userEmail && (
              <div className="reg-success-email-info">
                <p className="reg-success-email-label">
                  <strong>Ваш email:</strong>
                </p>
                <p className="reg-success-email-value">{userEmail}</p>
              </div>
            )}
            
            <p className="reg-success-instructions">
              На ваш email было отправлено письмо с подтверждением.<br/>
              Пожалуйста, проверьте вашу почту и перейдите по ссылке в письме.
            </p>
            
            <div className="reg-success-actions">
              <button 
                className="reg-success-button reg-success-primary-button" 
                onClick={() => navigate('/login')}
              >
                <i className="fas fa-sign-in-alt"></i> Перейти к входу
              </button>
              <button 
                className="reg-success-button reg-success-email-button" 
                onClick={handleOpenEmail}
              >
                <i className="fas fa-envelope"></i> Проверить почту
                {emailDomain && ` (${getEmailProvider(emailDomain).name})`}
              </button>
            </div>
            
            <div className="reg-success-note">
              <p><strong>Важно:</strong> Для входа в систему нужно подтвердить email.</p>
              <p>Если письмо не пришло, проверьте папку "Спам".</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

RegisterSuccessPage.displayName = 'RegisterSuccessPage';

export default RegisterSuccessPage;