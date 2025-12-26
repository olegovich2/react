import React, { useState } from 'react';
import { User } from '../../../types/index';
import './BlockUserModal.css'; // Используем те же стили

interface BlockUserModalProps {
  user: User;
  onConfirm: (duration: '7d' | '30d' | 'forever', reason?: string, deleteSessions?: boolean) => Promise<void>;
  onCancel: () => void;
}

const BlockUserModal: React.FC<BlockUserModalProps> = ({ user, onConfirm, onCancel }) => {
  const [duration, setDuration] = useState<'7d' | '30d' | 'forever'>('7d');
  const [reason, setReason] = useState('');
  const [deleteSessions, setDeleteSessions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!duration) {
      setError('Выберите срок блокировки');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onConfirm(duration, reason || undefined, deleteSessions);
      // onConfirm вызовет закрытие модалки после успеха
    } catch (err: any) {
      setError(err.message || 'Ошибка при блокировке пользователя');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDurationText = (duration: string) => {
    switch (duration) {
      case '7d':
        return '7 дней';
      case '30d':
        return '30 дней';
      case 'forever':
        return 'Бессрочно';
      default:
        return duration;
    }
  };

  const formatDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="users-page-modal-overlay">
      <div className="users-page-modal block-user-modal">
        <div className="users-page-modal-header">
          <h3>Блокировка пользователя</h3>
          <button
            onClick={onCancel}
            className="users-page-modal-close"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="users-page-modal-body">
          <div className="block-user-info">
            <div className="block-user-avatar">
              {user.login.charAt(0).toUpperCase()}
            </div>
            <div className="block-user-details">
              <h4 className="block-user-login">{user.login}</h4>
              <p className="block-user-email">{user.email}</p>
              <div className="block-user-stats">
                <span className="block-user-stat">
                  <strong>Опросы:</strong> {user.stats.surveys}
                </span>
                <span className="block-user-stat">
                  <strong>Изображения:</strong> {user.stats.images}
                </span>
                <span className="block-user-stat">
                  <strong>Активных сессий:</strong> {user.activeSessions}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="block-user-form">
            {error && (
              <div className="block-user-error">
                <span className="block-user-error-icon">❌</span>
                <span>{error}</span>
              </div>
            )}

            <div className="block-user-section">
              <h4 className="block-user-section-title">Срок блокировки</h4>
              <div className="block-user-duration-options">
                {(['7d', '30d', 'forever'] as const).map((option) => (
                  <label key={option} className="block-user-duration-option">
                    <input
                      type="radio"
                      name="duration"
                      value={option}
                      checked={duration === option}
                      onChange={(e) => setDuration(e.target.value as typeof duration)}
                      disabled={isSubmitting}
                      className="block-user-duration-radio"
                    />
                    <div className="block-user-duration-content">
                      <div className="block-user-duration-title">
                        {option === '7d' && '7 дней'}
                        {option === '30d' && '30 дней'}
                        {option === 'forever' && 'Бессрочно'}
                      </div>
                      <div className="block-user-duration-description">
                        {option === '7d' && `до ${formatDate(7)}`}
                        {option === '30d' && `до ${formatDate(30)}`}
                        {option === 'forever' && 'Без срока разблокировки'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="block-user-section">
              <h4 className="block-user-section-title">
                Причина блокировки (необязательно)
              </h4>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Опишите причину блокировки..."
                className="block-user-reason-input"
                rows={4}
                disabled={isSubmitting}
                maxLength={500}
              />
              <div className="block-user-reason-counter">
                {reason.length}/500 символов
              </div>
            </div>

            <div className="block-user-section">
              <label className="block-user-checkbox">
                <input
                  type="checkbox"
                  checked={deleteSessions}
                  onChange={(e) => setDeleteSessions(e.target.checked)}
                  disabled={isSubmitting}
                  className="block-user-checkbox-input"
                />
                <div className="block-user-checkbox-content">
                  <div className="block-user-checkbox-title">
                    Удалить активные сессии пользователя
                  </div>
                  <div className="block-user-checkbox-description">
                    Пользователь будет автоматически разлогинен со всех устройств
                    {user.activeSessions > 0 && (
                      <span className="block-user-sessions-count">
                        (сейчас {user.activeSessions} активных сессий)
                      </span>
                    )}
                  </div>
                </div>
              </label>
            </div>

            <div className="block-user-warning">
              <div className="block-user-warning-icon">⚠️</div>
              <div className="block-user-warning-content">
                <strong>Внимание:</strong> После блокировки пользователь не сможет 
                войти в систему до указанной даты. При бессрочной блокировке - 
                потребуется ручная разблокировка администратором.
              </div>
            </div>
          </form>
        </div>

        <div className="users-page-modal-footer">
          <button
            type="button"
            onClick={onCancel}
            className="users-page-modal-button users-page-modal-button-cancel"
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`users-page-modal-button users-page-modal-button-confirm ${
              duration === 'forever' ? 'permanent-block' : ''
            }`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="block-user-spinner">⏳</span>
                Блокировка...
              </>
            ) : (
              <>
                <span className="block-user-confirm-icon">🔒</span>
                Заблокировать {getDurationText(duration)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

BlockUserModal.displayName = 'BlockUserModal';

export default BlockUserModal;