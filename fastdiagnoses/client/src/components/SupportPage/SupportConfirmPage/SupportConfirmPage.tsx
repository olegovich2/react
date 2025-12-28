import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supportApi } from '../../../api/support.api';
import './SupportConfirmPage.css';

const SupportConfirmPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const [requestData, setRequestData] = useState<{
    requestId?: string;
    type?: string;
    login?: string;
  } | null>(null);

  useEffect(() => {
    const confirmSupportRequest = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Токен подтверждения отсутствует');
        return;
      }

      try {
        console.log('📧 [SupportConfirmPage] Подтверждение заявки с токеном:', 
          token.substring(0, 20) + '...');
        
        const response = await supportApi.confirmEmail(token);
        
        console.log('📧 [SupportConfirmPage] Ответ подтверждения:', response);

        if (response.success) {
          // Успешное подтверждение
          setStatus('success');
          setMessage(response.message || 'Заявка успешно подтверждена!');
          
          // Пытаемся извлечь данные из response
          if (response.data && typeof response.data === 'object') {
            setRequestData({
              requestId: (response.data as any).requestId,
              type: (response.data as any).type,
              login: (response.data as any).login,
            });
          }          
          
        } else {
          // Ошибка подтверждения
          setStatus('error');
          setMessage(response.message || 'Ошибка подтверждения заявки');
        }
      } catch (error: any) {
        console.error('❌ [SupportConfirmPage] Ошибка:', error);
        setStatus('error');
        setMessage(error.message || 'Ошибка сети при подтверждении заявки');
      }
    };

    confirmSupportRequest();
  }, [token, navigate]);

  const getTypeName = (type?: string): string => {
    const typeNames: Record<string, string> = {
      'password_reset': 'Смена пароля',
      'email_change': 'Смена email',
      'unblock': 'Разблокировка аккаунта',
      'account_deletion': 'Удаление аккаунта',
      'other': 'Другая проблема'
    };
    
    return type ? (typeNames[type] || type) : 'Заявка';
  };

  return (
    <div className="support-confirm-page">
      <div className="support-confirm-container">
        {status === 'loading' && (
          <div className="support-confirm-state loading">
            <div className="support-confirm-icon">
              <i className="fas fa-spinner fa-spin"></i>
            </div>
            <h1>Подтверждение заявки...</h1>
            <p>Пожалуйста, подождите</p>
            <div className="support-confirm-progress">
              <div className="progress-bar"></div>
            </div>
          </div>
        )}
        
        {status === 'success' && (
          <div className="support-confirm-state success">
            <div className="support-confirm-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <h1>✅ Заявка подтверждена!</h1>
            <p className="support-confirm-message">{message}</p>
            
            {requestData && (
              <div className="support-confirm-details">
                <div className="detail-card">
                  <div className="detail-icon">
                    <i className="fas fa-id-card"></i>
                  </div>
                  <div className="detail-content">
                    <h3>Детали заявки</h3>
                    {requestData.requestId && (
                      <p><strong>Номер заявки:</strong> {requestData.requestId}</p>
                    )}
                    {requestData.type && (
                      <p><strong>Тип проблемы:</strong> {getTypeName(requestData.type)}</p>
                    )}
                    {requestData.login && (
                      <p><strong>Логин:</strong> {requestData.login}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="support-confirm-instructions">
              <h3>📋 Что дальше?</h3>
              <ol>
                <li>Ваша заявка принята в работу</li>
                <li>Специалист свяжется с вами в течение 24 часов</li>
                <li>Все уведомления будут приходить на указанный email</li>
                <li>Вы можете проверять статус заявки в любое время</li>
              </ol>
            </div>
            
            <div className="support-confirm-redirect">
              <p>
                <i className="fas fa-clock"></i>
                Через 5 секунд вы будете перенаправлены на страницу поддержки...
              </p>
            </div>
            
            <div className="support-confirm-actions">
              <Link to="/support" className="support-confirm-button primary">
                <i className="fas fa-headset"></i> Вернуться в техподдержку
              </Link>
              <button 
                onClick={() => navigate('/')} 
                className="support-confirm-button secondary"
              >
                <i className="fas fa-home"></i> На главную
              </button>
            </div>
          </div>
        )}
        
        {status === 'error' && (
          <div className="support-confirm-state error">
            <div className="support-confirm-icon">
              <i className="fas fa-exclamation-circle"></i>
            </div>
            <h1>❌ Ошибка подтверждения</h1>
            <p className="support-confirm-error">{message}</p>
            
            <div className="support-confirm-error-details">
              <h3>Возможные причины:</h3>
              <ul>
                <li>Токен подтверждения устарел</li>
                <li>Заявка уже была подтверждена ранее</li>
                <li>Некорректная ссылка подтверждения</li>
                <li>Проблемы с соединением</li>
              </ul>
            </div>
            
            <div className="support-confirm-actions">
              <Link to="/support" className="support-confirm-button primary">
                <i className="fas fa-headset"></i> В техподдержку
              </Link>
              <button 
                onClick={() => window.location.reload()} 
                className="support-confirm-button secondary"
              >
                <i className="fas fa-redo"></i> Попробовать снова
              </button>
              <Link to="/" className="support-confirm-button tertiary">
                <i className="fas fa-home"></i> На главную
              </Link>
            </div>
            
            <div className="support-confirm-help">
              <p>
                <i className="fas fa-question-circle"></i>
                Если проблема сохраняется, обратитесь в техническую поддержку напрямую
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

SupportConfirmPage.displayName = 'SupportConfirmPage';

export default SupportConfirmPage;