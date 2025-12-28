import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import SupportForm from './SupportForm/SupportForm';
import './SupportPage.css';

const SupportPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, [navigate]);

  const handleSupportSuccess = (data: { requestId: string; email: string }) => {
    console.log('✅ Заявка успешно создана:', data);
  };

  const handleSupportError = (message: string) => {
    console.error('❌ Ошибка при создании заявки:', message);
  };

  return (
    <div className="support-page">
      <Header />
      
      <main className="support-main">
        <div className="support-container">
          {/* Кнопка "Назад" вверху */}
          <div className="support-back-button-container">
            <button 
              className="support-back-button"
              onClick={() => window.history.back()}
            >
              <i className="fas fa-arrow-left"></i> Назад
            </button>
          </div>

          <div className="support-content">
            <div className="support-icon">
              <i className="fas fa-headset"></i>
            </div>
            
            <h1 className="support-title">Техническая поддержка QuickDiagnosis</h1>
            
            <p className="support-subtitle">
              Опишите вашу проблему, и мы постараемся помочь как можно скорее
            </p>

            {/* ФОРМА ТЕХПОДДЕРЖКИ */}
            <div className="support-form-section">
              <SupportForm 
                onSuccess={handleSupportSuccess}
                onError={handleSupportError}
              />
            </div>

            {/* ЧАСТЫЕ ВОПРОСЫ */}
            <div className="support-faq">
              <h2><i className="fas fa-question-circle"></i> Частые вопросы</h2>
              <div className="faq-items">
                <div className="faq-item">
                  <h3>Сколько времени занимает обработка заявки?</h3>
                  <p>Обычно мы обрабатываем заявки в течение 1-24 часов. Заявки о смене пароля имеют приоритет.</p>
                </div>
                <div className="faq-item">
                  <h3>Почему нужно подтверждать email?</h3>
                  <p>Подтверждение email защищает вас от несанкционированных заявок от вашего имени.</p>
                </div>
                <div className="faq-item">
                  <h3>Что делать, если я забыл кодовое слово?</h3>
                  <p>Кодовое слово необходимо для проверки вашей личности. Если вы его забыли, укажите максимально подробную информацию в сообщении для верификации.</p>
                </div>
                <div className="faq-item">
                  <h3>Можно ли создать несколько заявок?</h3>
                  <p>Да, но старайтесь описывать все проблемы в одной заявке. Это ускорит процесс решения.</p>
                </div>
                <div className="faq-item">
                  <h3>Как узнать статус моей заявки?</h3>
                  <p>После подтверждения email вы будете получать уведомления о каждом изменении статуса.</p>
                </div>
                <div className="faq-item">
                  <h3>Моя проблема не подходит ни под один тип</h3>
                  <p>Выберите "Другая проблема" и подробно опишите ситуацию в сообщении.</p>
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