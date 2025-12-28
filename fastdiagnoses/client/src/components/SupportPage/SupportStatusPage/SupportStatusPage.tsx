import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supportApi } from '../../../api/support.api';
import './SupportStatusPage.css';

// Тип для данных статуса
interface SupportStatusData {
  requestId: string;
  type: string;
  status: string;
  rawStatus: string;
  created: string;
  updated: string;
  resolved?: string;
}

const SupportStatusPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  
  const [statusData, setStatusData] = useState<SupportStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  // Функция для форматирования даты
  const formatDate = useCallback((dateString: any): string => {
    if (!dateString) {
      return 'Не указано';
    }
    
    try {
      let date: Date;
      
      if (typeof dateString === 'string') {
        // Пробуем разные форматы дат
        const normalized = dateString
          .replace(' ', 'T')
          .replace(/\.\d{3}Z$/, 'Z');
        
        date = new Date(normalized);
        
        if (isNaN(date.getTime())) {
          date = new Date(dateString);
        }
      } else if (dateString instanceof Date) {
        date = dateString;
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('⚠️ Не удалось распарсить дату:', dateString);
        return 'Некорректная дата';
      }
      
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('❌ Ошибка форматирования даты:', error);
      return 'Ошибка даты';
    }
  }, []);

  // Функция для расчета времени назад
  const getTimeAgo = useCallback((dateString: any): string => {
    if (!dateString) {
      return 'не указано';
    }
    
    try {
      let date: Date;
      
      if (typeof dateString === 'string') {
        const normalized = dateString
          .replace(' ', 'T')
          .replace(/\.\d{3}Z$/, 'Z');
        
        date = new Date(normalized);
        
        if (isNaN(date.getTime())) {
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return 'неизвестно';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) return `${diffDays} дн. назад`;
      if (diffHours > 0) return `${diffHours} час. назад`;
      if (diffMins > 0) return `${diffMins} мин. назад`;
      return 'только что';
    } catch (error) {
      console.error('Ошибка расчета времени:', error);
      return 'неизвестно';
    }
  }, []);

  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'pending': return '#ffa500';
      case 'confirmed': return '#1890ff';
      case 'in_progress': return '#fa8c16';
      case 'resolved': return '#52c41a';
      case 'rejected': return '#f5222d';
      case 'cancelled': return '#d9d9d9';
      default: return '#666';
    }
  }, []);

  const getStatusText = useCallback((status: string): string => {
    const statusMap: Record<string, string> = {
      'pending': '📧 Ожидает подтверждения email',
      'confirmed': '⏳ Подтверждена, в очереди на обработку',
      'in_progress': '🔄 В работе (специалист рассматривает вашу заявку)',
      'resolved': '✅ Решена (проблема устранена)',
      'rejected': '❌ Отклонена (см. комментарий специалиста)',
      'cancelled': '🚫 Отменена',
    };
    return statusMap[status] || status;
  }, []);

  const getStatusIcon = useCallback((status: string): string => {
    switch (status) {
      case 'pending': return 'fas fa-envelope';
      case 'confirmed': return 'fas fa-clock';
      case 'in_progress': return 'fas fa-user-cog';
      case 'resolved': return 'fas fa-check-circle';
      case 'rejected': return 'fas fa-times-circle';
      case 'cancelled': return 'fas fa-ban';
      default: return 'fas fa-info-circle';
    }
  }, []);

  const getTypeText = useCallback((type: string): string => {
    const typeMap: Record<string, string> = {
      'password_reset': '🔐 Смена пароля',
      'email_change': '📧 Смена email',
      'unblock': '🔓 Разблокировка аккаунта',
      'account_deletion': '🗑️ Удаление аккаунта',
      'other': '❓ Другая проблема',
    };
    return typeMap[type] || type;
  }, []);

  // ИСПРАВЛЕННЫЙ fetchStatus
const fetchStatus = useCallback(async () => {
  if (!requestId) return;
  
  try {
    setLoading(true);
    const response = await supportApi.checkStatus(requestId);
    
    console.log('📊 Полный response:', response);
    console.log('📊 response.data:', response.data);
    console.log('📊 response.data.data (реальные данные):', response.data?.data);
    
    if (response.success && response.data?.data) {
      const apiData = response.data.data;
      
      console.log('📊 apiData содержимое:', {
        requestId: apiData.requestId,
        type: apiData.type,
        status: apiData.status,
        rawStatus: apiData.rawStatus,
        created: apiData.created,
        updated: apiData.updated,
        resolved: apiData.resolved,
        allKeys: Object.keys(apiData)
      });
      
      setStatusData({
        requestId: apiData.requestId || requestId,
        type: apiData.type || 'unknown',
        status: apiData.status || 'unknown',
        rawStatus: apiData.rawStatus || apiData.status || 'unknown',
        created: apiData.created,
        updated: apiData.updated,
        resolved: apiData.resolved
      });
      setError(null);
      setLastChecked(new Date().toLocaleTimeString('ru-RU'));
    } else {
      setError(response.message || 'Не удалось получить статус заявки');
    }
  } catch (error: any) {
    console.error('❌ Ошибка при получении статуса:', error);
    setError(error.message || 'Ошибка при получении статуса');
  } finally {
    setLoading(false);
  }
}, [requestId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]); // Теперь fetchStetus в зависимостях

  const handleShowDetails = () => {
    setShowDetails(!showDetails);
    if (!showDetails) {
      fetchStatus(); // Обновляем данные при открытии
    }
  };

  const handleRefresh = () => {
    fetchStatus();
  };

  if (loading && !statusData) {
    return (
      <div className="support-status-page">
        <div className="support-status-container">
          <div className="support-status-loading">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Загружаем информацию о заявке...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="support-status-page">
      <div className="support-status-container">
        <div className="support-status-header">
          <h1>
            <i className="fas fa-headset"></i> Статус заявки техподдержки
          </h1>
          <p className="support-status-subtitle">
            Отслеживайте текущий статус обработки вашей заявки
          </p>
        </div>

        {error ? (
          <div className="support-status-error">
            <i className="fas fa-exclamation-triangle"></i>
            <h3>Ошибка</h3>
            <p>{error}</p>
            <button onClick={handleRefresh} className="support-status-button">
              <i className="fas fa-redo"></i> Попробовать снова
            </button>
          </div>
        ) : statusData ? (
          <div className="support-status-content">
            {/* КАРТОЧКА С ОСНОВНОЙ ИНФОРМАЦИЕЙ */}
            <div className="status-card">
              <div className="status-header">
                <div className="status-id">
                  <i className="fas fa-hashtag"></i>
                  <span>Заявка #{statusData.requestId}</span>
                </div>
                <div 
                  className="status-badge" 
                  style={{ backgroundColor: getStatusColor(statusData.rawStatus) }}
                >
                  <i className={getStatusIcon(statusData.rawStatus)}></i>
                  <span>{getStatusText(statusData.rawStatus)}</span>
                </div>
              </div>

              <div className="status-info">
                <div className="info-item">
                  <i className="fas fa-tag"></i>
                  <span>Тип:</span>
                  <strong>{getTypeText(statusData.type)}</strong>
                </div>
                
                <div className="info-item">
                  <i className="fas fa-calendar-plus"></i>
                  <span>Создана:</span>
                  <strong>{formatDate(statusData.created)}</strong>
                  <span className="time-ago">({getTimeAgo(statusData.created)})</span>
                </div>

                <div className="info-item">
                  <i className="fas fa-sync-alt"></i>
                  <span>Обновлена:</span>
                  <strong>{formatDate(statusData.updated)}</strong>
                  <span className="time-ago">({getTimeAgo(statusData.updated)})</span>
                </div>

                {statusData.resolved && (
                  <div className="info-item">
                    <i className="fas fa-flag-checkered"></i>
                    <span>Решена:</span>
                    <strong>{formatDate(statusData.resolved)}</strong>
                    <span className="time-ago">({getTimeAgo(statusData.resolved)})</span>
                  </div>
                )}

                {lastChecked && (
                  <div className="info-item last-checked">
                    <i className="fas fa-eye"></i>
                    <span>Последняя проверка:</span>
                    <strong>{lastChecked}</strong>
                  </div>
                )}
              </div>

              {/* КНОПКА "ПОСМОТРЕТЬ" - ПОКАЗЫВАЕТ ДОПОЛНИТЕЛЬНУЮ ИНФОРМАЦИЮ */}
              <div className="status-actions">
                <button 
                  onClick={handleShowDetails}
                  className="view-details-button"
                >
                  <i className={showDetails ? "fas fa-chevron-up" : "fas fa-chevron-down"}></i>
                  {showDetails ? 'Скрыть детали' : 'Посмотреть текущий статус'}
                </button>
                
                <button 
                  onClick={handleRefresh}
                  className="refresh-button"
                  title="Обновить статус"
                >
                  <i className="fas fa-redo"></i>
                </button>
              </div>

              {/* ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ (ПОКАЗЫВАЕТСЯ ПРИ НАЖАТИИ "ПОСМОТРЕТЬ") */}
              {showDetails && (
                <div className="status-details">
                  <h3>
                    <i className="fas fa-info-circle"></i> Детали текущего статуса
                  </h3>
                  
                  <div className="status-timeline">
                    <div className={`timeline-item ${statusData.rawStatus === 'pending' ? 'active' : statusData.rawStatus === 'confirmed' || statusData.rawStatus === 'in_progress' || statusData.rawStatus === 'resolved' || statusData.rawStatus === 'rejected' || statusData.rawStatus === 'cancelled' ? 'completed' : 'pending'}`}>
                      <div className="timeline-icon">
                        <i className="fas fa-envelope"></i>
                      </div>
                      <div className="timeline-content">
                        <h4>Подтверждение email</h4>
                        <p>Ожидание подтверждения email пользователем</p>
                        {statusData.rawStatus === 'pending' && (
                          <span className="current-status">Текущий этап</span>
                        )}
                      </div>
                    </div>

                    <div className={`timeline-item ${statusData.rawStatus === 'confirmed' ? 'active' : statusData.rawStatus === 'in_progress' || statusData.rawStatus === 'resolved' || statusData.rawStatus === 'rejected' || statusData.rawStatus === 'cancelled' ? 'completed' : 'pending'}`}>
                      <div className="timeline-icon">
                        <i className="fas fa-clock"></i>
                      </div>
                      <div className="timeline-content">
                        <h4>В очереди</h4>
                        <p>Заявка подтверждена и ожидает рассмотрения специалистом</p>
                        {statusData.rawStatus === 'confirmed' && (
                          <span className="current-status">Текущий этап</span>
                        )}
                      </div>
                    </div>

                    <div className={`timeline-item ${statusData.rawStatus === 'in_progress' ? 'active' : statusData.rawStatus === 'resolved' || statusData.rawStatus === 'rejected' || statusData.rawStatus === 'cancelled' ? 'completed' : 'pending'}`}>
                      <div className="timeline-icon">
                        <i className="fas fa-user-cog"></i>
                      </div>
                      <div className="timeline-content">
                        <h4>В работе</h4>
                        <p>Специалист рассматривает вашу заявку</p>
                        {statusData.rawStatus === 'in_progress' && (
                          <span className="current-status">Текущий этап</span>
                        )}
                      </div>
                    </div>

                    <div className={`timeline-item ${['resolved', 'rejected', 'cancelled'].includes(statusData.rawStatus) ? 'active' : 'pending'}`}>
                      <div className="timeline-icon">
                        <i className="fas fa-flag-checkered"></i>
                      </div>
                      <div className="timeline-content">
                        <h4>Завершение</h4>
                        <p>
                          {statusData.rawStatus === 'resolved' && 'Заявка успешно решена'}
                          {statusData.rawStatus === 'rejected' && 'Заявка отклонена'}
                          {statusData.rawStatus === 'cancelled' && 'Заявка отменена'}
                          {!['resolved', 'rejected', 'cancelled'].includes(statusData.rawStatus) && 'Ожидание завершения обработки'}
                        </p>
                        {['resolved', 'rejected', 'cancelled'].includes(statusData.rawStatus) && (
                          <span className="current-status">Завершено</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="status-help">
                    <h4>
                      <i className="fas fa-question-circle"></i> Что делать дальше?
                    </h4>
                    {statusData.rawStatus === 'pending' && (
                      <p>Проверьте вашу почту и подтвердите заявку по ссылке в письме.</p>
                    )}
                    {statusData.rawStatus === 'confirmed' && (
                      <p>Ваша заявка в очереди. Ожидайте начала обработки специалистом.</p>
                    )}
                    {statusData.rawStatus === 'in_progress' && (
                      <p>Специалист работает над вашей заявкой. Ожидайте решения.</p>
                    )}
                    {statusData.rawStatus === 'resolved' && (
                      <p>Заявка решена! Проверьте вашу почту для получения подробностей.</p>
                    )}
                    {statusData.rawStatus === 'rejected' && (
                      <p>Заявка отклонена. Проверьте почту для получения причины отказа.</p>
                    )}
                    {statusData.rawStatus === 'cancelled' && (
                      <p>Заявка отменена. При необходимости создайте новую заявку.</p>
                    )}
                  </div>
                </div>
              )}

              {/* КНОПКИ ДЕЙСТВИЙ */}
              <div className="action-buttons">
                <button onClick={handleRefresh} className="action-button primary">
                  <i className="fas fa-sync-alt"></i> Обновить статус
                </button>
                
                <Link to="/support" className="action-button secondary">
                  <i className="fas fa-headset"></i> Новая заявка
                </Link>
                
                <Link to="/" className="action-button tertiary">
                  <i className="fas fa-home"></i> На главную
                </Link>
              </div>
            </div>

            {/* СОВЕТЫ */}
            <div className="status-tips">
              <h3>
                <i className="fas fa-lightbulb"></i> Советы
              </h3>
              <ul>
                <li>Нажмите "Обновить статус" для получения актуальной информации</li>
                <li>Используйте кнопку "Посмотреть" для детального отображения этапов</li>
                <li>Сохраните номер заявки #{statusData.requestId} для быстрого доступа</li>
                <li>При возникновении вопросов создайте новую заявку</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="support-status-not-found">
            <i className="fas fa-search"></i>
            <h3>Заявка не найдена</h3>
            <p>Проверьте правильность введенного номера заявки</p>
            <Link to="/support" className="support-status-button">
              <i className="fas fa-headset"></i> Вернуться в техподдержку
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

SupportStatusPage.displayName = 'SupportStatusPage';

export default SupportStatusPage;