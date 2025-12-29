import React, { useState, useEffect } from 'react';
import { User } from '../../../../types';
import { supportService } from '../../../../services/adminApi';
import './SupportRequestModal.css';

// Типы для модального окна
type ModalState = 'loading' | 'encrypted' | 'validating' | 'result' | 'confirm';

interface SupportRequestModalProps {
  user: User;
  requestType: 'password_reset' | 'email_change' | 'unblock' | 'account_deletion' | 'other';
  onClose: () => void;
  onProcess: (requestId: string, action: 'approve' | 'reject', reason?: string) => Promise<void>;
}

const SupportRequestModal: React.FC<SupportRequestModalProps> = ({
  user,
  requestType,
  onClose,
  onProcess
}) => {
  const [state, setState] = useState<ModalState>('loading');
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Загружаем запросы пользователя
  useEffect(() => {
    const loadRequests = async () => {
      try {
        console.log('📥 [SupportRequestModal] Загрузка запросов:', {
          user: user.login,
          type: requestType
        });

        const response = await supportService.getUserSupportRequests(
          user.login,
          requestType,
          'all' // все статусы
        );

        if (response.success && response.data?.requests) {
          const activeRequests = response.data.requests.filter(
            (req: any) => req.status !== 'rejected' && req.status !== 'completed'
          );

          setRequests(activeRequests);
          
          if (activeRequests.length > 0) {
            setSelectedRequest(activeRequests[0]);
            setState('encrypted');
          } else {
            setError('Нет активных запросов этого типа');
          }
        } else {
          setError('Не удалось загрузить запросы');
        }
      } catch (err: any) {
        console.error('❌ [SupportRequestModal] Ошибка загрузки:', err);
        setError(err.message || 'Ошибка загрузки запросов');
      }
    };

    loadRequests();
  }, [user.login, requestType]);

  // Функция для автоматической проверки запроса
  const handleValidate = async () => {
    if (!selectedRequest) return;

    setState('validating');
    setError('');

    try {
      console.log('🔍 [SupportRequestModal] Проверка запроса:', selectedRequest.id);

      const response = await supportService.validateSupportRequest(selectedRequest.id);

      if (response.success) {
        setValidationResult(response);
        setState('result');
      } else {
        setError(response.message || 'Ошибка проверки');
        setState('encrypted');
      }
    } catch (err: any) {
      console.error('❌ [SupportRequestModal] Ошибка проверки:', err);
      setError(err.message || 'Ошибка проверки запроса');
      setState('encrypted');
    }
  };

  // Функция для подтверждения действия
  const handleApprove = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      await onProcess(selectedRequest.id, 'approve');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка выполнения действия');
    } finally {
      setIsProcessing(false);
    }
  };

  // Функция для отказа
  const handleReject = async () => {
    if (!selectedRequest) return;

    if (!rejectReason.trim()) {
      setError('Укажите причину отказа');
      return;
    }

    setIsProcessing(true);
    try {
      await onProcess(selectedRequest.id, 'reject', rejectReason);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка при отклонении запроса');
    } finally {
      setIsProcessing(false);
    }
  };

  // Получаем название типа запроса
  const getRequestTypeName = () => {
    const names: Record<string, string> = {
      password_reset: 'Сброс пароля',
      email_change: 'Смена email',
      unblock: 'Разблокировка аккаунта',
      account_deletion: 'Удаление аккаунта',
      other: 'Другой запрос'
    };
    return names[requestType] || requestType;
  };

  // Рендерим зашифрованные данные
  const renderEncryptedData = () => {
    if (!selectedRequest) return null;

    return (
      <div className="support-modal-encrypted">
        <div className="support-modal-section">
          <h4>🔒 Зашифрованные данные</h4>
          <div className="encrypted-data-grid">
            <div className="encrypted-data-item">
              <span className="encrypted-label">ID запроса:</span>
              <span className="encrypted-value">{selectedRequest.publicId}</span>
            </div>
            <div className="encrypted-data-item">
              <span className="encrypted-label">Дата создания:</span>
              <span className="encrypted-value">
                {new Date(selectedRequest.createdAt).toLocaleString('ru-RU')}
              </span>
            </div>
            <div className="encrypted-data-item">
              <span className="encrypted-label">Email пользователя:</span>
              <span className="encrypted-value">{selectedRequest.email}</span>
            </div>
            <div className="encrypted-data-item">
              <span className="encrypted-label">Статус:</span>
              <span className={`encrypted-status status-${selectedRequest.status}`}>
                {selectedRequest.status}
              </span>
            </div>
            {selectedRequest.isOverdue && (
              <div className="encrypted-data-item overdue">
                <span className="encrypted-label">⚠️ Срок:</span>
                <span className="encrypted-value">Просрочен (`{'>'}`24ч)</span>
              </div>
            )}
            {selectedRequest.message && (
              <div className="encrypted-data-item full-width">
                <span className="encrypted-label">Сообщение:</span>
                <div className="encrypted-message">{selectedRequest.message}</div>
              </div>
            )}
          </div>
        </div>

        <div className="support-modal-section">
          <h4>🔐 Системная информация</h4>
          <p className="system-info">
            Данные пользователя зашифрованы. Нажмите "Проверить" для автоматической проверки
            совпадения с данными в системе.
          </p>
          <p className="system-warning">
            ⚠️ При проверке система расшифрует данные и сравнит их с информацией в базе.
            Вы не увидите расшифрованные данные в целях безопасности.
          </p>
        </div>
      </div>
    );
  };

  // Рендерим результат проверки
  const renderValidationResult = () => {
    if (!validationResult) return null;

    const { isValid, errors, checkedFields } = validationResult;

    return (
      <div className="support-modal-validation">
        <div className={`validation-header ${isValid ? 'valid' : 'invalid'}`}>
          <h4>{isValid ? '✅ Проверка успешна' : '❌ Проверка не удалась'}</h4>
        </div>

        <div className="validation-results">
          <div className="validation-item">
            <span className="validation-label">Логин:</span>
            <span className={`validation-status ${checkedFields.login ? 'success' : 'error'}`}>
              {checkedFields.login ? '✓ Совпадает' : '✗ Не совпадает'}
            </span>
          </div>

          <div className="validation-item">
            <span className="validation-label">Секретное слово:</span>
            <span className={`validation-status ${checkedFields.secretWord ? 'success' : 'error'}`}>
              {checkedFields.secretWord ? '✓ Совпадает' : '✗ Не совпадает'}
            </span>
          </div>

          {checkedFields.password !== null && (
            <div className="validation-item">
              <span className="validation-label">Пароль:</span>
              <span className={`validation-status ${checkedFields.password ? 'success' : 'error'}`}>
                {checkedFields.password ? '✓ Совпадает' : '✗ Не совпадает'}
              </span>
            </div>
          )}

          {errors && errors.length > 0 && (
            <div className="validation-errors">
              <h5>❌ Обнаруженные ошибки:</h5>
              <ul>
                {errors.map((error: string, index: number) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {isValid && (
            <div className="validation-success">
              <div className="success-icon">✅</div>
              <div className="success-message">
                Все данные подтверждены. Можете выполнить действие.
              </div>
            </div>
          )}
        </div>

        {!isValid && (
          <div className="rejection-section">
            <h5>📝 Причина отказа:</h5>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Опишите причину отказа..."
              className="rejection-textarea"
              rows={3}
            />
            <div className="rejection-hint">
              Это сообщение будет отправлено пользователю на email
            </div>
          </div>
        )}
      </div>
    );
  };

  // Рендерим подтверждение действия
  const renderConfirmation = () => {
    const actionNames: Record<string, string> = {
      password_reset: 'сбросить пароль',
      email_change: 'сменить email',
      unblock: 'разблокировать аккаунт',
      account_deletion: 'удалить аккаунт',
      other: 'обработать запрос'
    };

    return (
      <div className="support-modal-confirm">
        <div className="confirm-header">
          <h4>⚠️ Подтверждение действия</h4>
        </div>
        
        <div className="confirm-content">
          <div className="confirm-icon">⚡</div>
          <div className="confirm-message">
            Вы собираетесь <strong>{actionNames[requestType]}</strong> для пользователя:
          </div>
          
          <div className="confirm-user-info">
            <div className="confirm-user-item">
              <span className="confirm-label">👤 Логин:</span>
              <span className="confirm-value">{user.login}</span>
            </div>
            <div className="confirm-user-item">
              <span className="confirm-label">✉️ Email:</span>
              <span className="confirm-value">{user.email}</span>
            </div>
            <div className="confirm-user-item">
              <span className="confirm-label">🆔 Запрос:</span>
              <span className="confirm-value">{selectedRequest?.publicId}</span>
            </div>
          </div>

          <div className="confirm-warning">
            <div className="warning-icon">❗</div>
            <div className="warning-text">
              Это действие {requestType === 'account_deletion' ? 'необратимо' : 'требует подтверждения'}.
              {requestType === 'password_reset' && ' Новый пароль будет отправлен на email пользователя.'}
              {requestType === 'email_change' && ' Письмо с подтверждением будет отправлено на старый и новый email.'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Основной рендер
  return (
    <div className="support-modal-overlay">
      <div className="support-modal">
        {/* Шапка модального окна */}
        <div className="support-modal-header">
          <div className="support-modal-title">
            <h3>
              {requestType === 'password_reset' && '🔑'}
              {requestType === 'email_change' && '✉️'}
              {requestType === 'unblock' && '🔓'}
              {requestType === 'account_deletion' && '🗑️'}
              {requestType === 'other' && '📩'}
              {' '}{getRequestTypeName()}
            </h3>
            <div className="support-modal-subtitle">
              Пользователь: <strong>{user.login}</strong>
              {requests.length > 1 && (
                <span className="requests-count"> ({requests.length} запросов)</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="support-modal-close"
            disabled={isProcessing || state === 'validating'}
          >
            ✕
          </button>
        </div>

        {/* Тело модального окна */}
        <div className="support-modal-body">
          {error && (
            <div className="support-modal-error">
              <span className="error-icon">❌</span>
              <span>{error}</span>
            </div>
          )}

          {/* Состояние загрузки */}
          {state === 'loading' && (
            <div className="support-modal-loading">
              <div className="loading-spinner">⏳</div>
              <p>Загрузка запросов...</p>
            </div>
          )}

          {/* Состояние проверки */}
          {state === 'validating' && (
            <div className="support-modal-loading">
              <div className="loading-spinner">🔍</div>
              <p>Проверка данных...</p>
              <p className="loading-subtext">
                Система проверяет зашифрованные данные
              </p>
            </div>
          )}

          {/* Зашифрованные данные */}
          {state === 'encrypted' && renderEncryptedData()}

          {/* Результат проверки */}
          {state === 'result' && renderValidationResult()}

          {/* Подтверждение действия */}
          {state === 'confirm' && renderConfirmation()}
        </div>

        {/* Футер модального окна */}
        <div className="support-modal-footer">
          {/* Кнопки для состояния с зашифрованными данными */}
          {state === 'encrypted' && (
            <>
              <button
                onClick={handleValidate}
                className="support-modal-button validate-button"
                disabled={isProcessing}
              >
                🔍 Проверить
              </button>
              <button
                onClick={onClose}
                className="support-modal-button cancel-button"
                disabled={isProcessing}
              >
                ❌ Закрыть
              </button>
            </>
          )}

          {/* Кнопки для результата проверки */}
          {state === 'result' && validationResult && (
            <>
              {validationResult.isValid ? (
                <>
                  <button
                    onClick={() => setState('confirm')}
                    className="support-modal-button approve-button"
                    disabled={isProcessing}
                  >
                    ✅ Выполнить
                  </button>
                  <button
                    onClick={() => setState('encrypted')}
                    className="support-modal-button back-button"
                    disabled={isProcessing}
                  >
                    ↩️ Назад
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleReject}
                    className="support-modal-button reject-button"
                    disabled={isProcessing || !rejectReason.trim()}
                  >
                    ❌ Отклонить
                  </button>
                  <button
                    onClick={() => setState('encrypted')}
                    className="support-modal-button back-button"
                    disabled={isProcessing}
                  >
                    ↩️ Назад
                  </button>
                </>
              )}
            </>
          )}

          {/* Кнопки для подтверждения действия */}
          {state === 'confirm' && (
            <>
              <button
                onClick={handleApprove}
                className="support-modal-button confirm-approve-button"
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ Выполняю...' : '✅ Подтвердить'}
              </button>
              <button
                onClick={() => setState('result')}
                className="support-modal-button back-button"
                disabled={isProcessing}
              >
                ↩️ Назад
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

SupportRequestModal.displayName = 'SupportRequestModal';
export default SupportRequestModal;