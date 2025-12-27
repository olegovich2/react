import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import './SupportPage.css';

const SupportPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, [navigate]);
  
  return (
    <div className="support-page">
      <Header />
      
      <main className="support-main">
        <div className="support-container">
          <div className="support-content">
            <div className="support-icon">
              <i className="fas fa-tools"></i>
            </div>
            <h1 className="support-title">Техническая поддержка</h1>
            <p className="support-subtitle">
              Раздел находится в разработке
            </p>
            
            <div className="support-message">
              <p>
                <i className="fas fa-info-circle"></i>
                Мы активно работаем над созданием полноценной системы поддержки пользователей.
              </p>
              <p>
                Вскоре здесь появится форма для обращения в техническую поддержку, 
                база знаний, часто задаваемые вопросы и система отслеживания обращений.
              </p>
            </div>

            <div className="support-contact-info">
              <h2><i className="fas fa-headset"></i> Как связаться с поддержкой</h2>
              <div className="contact-methods">
                <div className="contact-method">
                  <i className="fas fa-envelope"></i>
                  <div>
                    <h3>Email</h3>
                    <p>support@quickdiagnosis.ru</p>
                  </div>
                </div>
                <div className="contact-method">
                  <i className="fas fa-clock"></i>
                  <div>
                    <h3>Часы работы</h3>
                    <p>Пн-Пт: 9:00 - 18:00</p>
                  </div>
                </div>
                <div className="contact-method">
                  <i className="fas fa-phone"></i>
                  <div>
                    <h3>Телефон</h3>
                    <p>+7 (XXX) XXX-XX-XX</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="support-actions">
              <button 
                className="support-button-primary"
                onClick={() => window.history.back()}
              >
                <i className="fas fa-arrow-left"></i> Назад
              </button>
              <button 
                className="support-button-secondary"
                onClick={() => window.location.href = '/register'}
              >
                <i className="fas fa-question-circle"></i> Частые вопросы
              </button>
            </div>

            <div className="support-faq">
              <h2><i className="fas fa-question-circle"></i> Частые вопросы</h2>
              <div className="faq-items">
                <div className="faq-item">
                  <h3>Когда появится полноценная поддержка?</h3>
                  <p>Мы планируем запустить систему поддержки в течение ближайших недель.</p>
                </div>
                <div className="faq-item">
                  <h3>Как восстановить доступ к аккаунту?</h3>
                  <p>Используйте функцию "Забыли пароль" на странице входа или обратитесь по email.</p>
                </div>
                <div className="faq-item">
                  <h3>Есть ли мобильное приложение?</h3>
                  <p>В данный момент доступна только веб-версия системы. Мобильное приложение в разработке.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

SupportPage.displayName = 'SupportPage';

export default SupportPage;