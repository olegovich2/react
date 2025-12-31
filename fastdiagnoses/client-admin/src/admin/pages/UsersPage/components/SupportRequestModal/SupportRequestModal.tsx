import React, { useState, useEffect } from "react";
import { User } from "../../../../types";
import { supportService } from "../../../../services/adminApi";
import "./SupportRequestModal.css";

// Типы для модального окна
type ModalState = "loading" | "encrypted" | "validating" | "confirm";

interface SupportRequestModalProps {
  user: User;
  requestType:
    | "password_reset"
    | "email_change"
    | "unblock"
    | "account_deletion"
    | "other";
  onClose: () => void;
  onProcess: (
    requestId: string,
    action: "approve" | "reject",
    reason?: string,
    emailResponse?: string
  ) => Promise<void>;
}

// Интерфейсы для API ответов
interface ValidationResponse {
  success: boolean;
  isValid: boolean;
  message?: string;
  errors?: string[];
  checkedFields: {
    login: boolean;
    email?: boolean; // Сделаем опциональным для обратной совместимости
    secretWord: boolean;
    password: boolean | null;
  };
  validationDetails?: {
    userExists: boolean;
    emailMatches?: boolean;
    secretWordMatches: boolean;
    passwordMatches: boolean | null;
    isOtherType: boolean;
    hasMessage?: boolean;
    messageLength?: number;
  };
  requestInfo: {
    id: string;
    publicId: string;
    type: string;
    login: string;
    email: string;
    newEmail?: string;
    status: string;
    createdAt: string;
    isOverdue: boolean;
  };
}

interface SupportRequest {
  id: string;
  publicId: string;
  type: string;
  login: string;
  email: string;
  status: string;
  createdAt: string;
  isOverdue: boolean;
  newEmail?: string;
  message?: string;
}

const SupportRequestModal: React.FC<SupportRequestModalProps> = ({
  user,
  requestType,
  onClose,
  onProcess,
}) => {
  const [state, setState] = useState<ModalState>("loading");
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(
    null
  );
  const [validationResult, setValidationResult] =
    useState<ValidationResponse | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [emailResponse, setEmailResponse] = useState("");
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Загружаем запросы пользователя
  useEffect(() => {
    const loadRequests = async () => {
      try {
        console.log("📥 [SupportRequestModal] Загрузка запросов:", {
          user: user.login,
          type: requestType,
        });

        const response = await supportService.getUserSupportRequests(
          user.login,
          requestType,
          "all" // все статусы
        );

        if (response.success && response.data?.requests) {
          const activeRequests = response.data.requests.filter(
            (req: any) =>
              req.status !== "rejected" && req.status !== "completed"
          );

          setRequests(activeRequests);

          if (activeRequests.length > 0) {
            const firstRequest = activeRequests[0];
            setSelectedRequest(firstRequest);

            // АВТОМАТИЧЕСКАЯ ПРОВЕРКА ПРИ ОТКРЫТИИ
            console.log(
              "🔍 [SupportRequestModal] Автоматическая проверка запроса:",
              firstRequest.id
            );
            await handleValidate(firstRequest.id);
          } else {
            setError("Нет активных запросов этого типа");
            setState("encrypted");
          }
        } else {
          setError(response.message || "Не удалось загрузить запросы");
          setState("encrypted");
        }
      } catch (err: any) {
        console.error("❌ [SupportRequestModal] Ошибка загрузки:", err);
        setError(err.message || "Ошибка загрузки запросов");
        setState("encrypted");
      }
    };

    loadRequests();
  }, [user.login, requestType]);

  // Функция для автоматической проверки запроса
  const handleValidate = async (requestId: string) => {
    setState("validating");
    setError("");

    try {
      console.log("🔍 [SupportRequestModal] Проверка запроса:", requestId);

      const response: ValidationResponse =
        await supportService.validateSupportRequest(requestId);

      if (response.success) {
        setValidationResult(response);
        setState("encrypted"); // Всегда переходим в режим отображения данных

        console.log("✅ [SupportRequestModal] Результат проверки:", {
          isValid: response.isValid,
          errorsCount: response.errors?.length || 0,
          checkedFields: response.checkedFields,
          validationDetails: response.validationDetails,
        });
      } else {
        setError(response.message || "Ошибка проверки");
        setState("encrypted");
      }
    } catch (err: any) {
      console.error("❌ [SupportRequestModal] Ошибка проверки:", err);
      setError(err.message || "Ошибка проверки запроса");
      setState("encrypted");
    }
  };

  // Функция для подтверждения действия
  const handleApprove = async () => {
    if (!selectedRequest) return;

    // Для типа "other" проверяем наличие ответа
    if (selectedRequest.type === "other" && !emailResponse.trim()) {
      setError('Для типа "other" необходимо написать ответ пользователю');
      return;
    }

    setIsProcessing(true);
    try {
      await onProcess(
        selectedRequest.id,
        "approve",
        undefined,
        selectedRequest.type === "other" ? emailResponse : undefined
      );
      onClose();
    } catch (err: any) {
      setError(err.message || "Ошибка выполнения действия");
    } finally {
      setIsProcessing(false);
    }
  };

  // Функция для отказа
  const handleReject = async () => {
    if (!selectedRequest) return;

    if (!rejectReason.trim()) {
      setError("Укажите причину отказа");
      return;
    }

    setIsProcessing(true);
    try {
      await onProcess(selectedRequest.id, "reject", rejectReason);
      onClose();
    } catch (err: any) {
      setError(err.message || "Ошибка при отклонении запроса");
    } finally {
      setIsProcessing(false);
    }
  };

  // Получаем название типа запроса
  const getRequestTypeName = () => {
    const names: Record<string, string> = {
      password_reset: "Сброс пароля",
      email_change: "Смена email",
      unblock: "Разблокировка аккаунта",
      account_deletion: "Удаление аккаунта",
      other: "Другой запрос",
    };
    return names[requestType] || requestType;
  };

  // Получаем иконку для типа запроса
  const getRequestTypeIcon = () => {
    const icons: Record<string, string> = {
      password_reset: "🔑",
      email_change: "✉️",
      unblock: "🔓",
      account_deletion: "🗑️",
      other: "📩",
    };
    return icons[requestType] || "📋";
  };

  // Получаем описание для типа запроса
  const getRequestTypeDescription = () => {
    const descriptions: Record<string, string> = {
      password_reset: "Создание ссылки для сброса пароля",
      email_change: "Изменение email адреса пользователя",
      unblock: "Снятие блокировки с аккаунта",
      account_deletion: "Полное удаление аккаунта и всех данных",
      other: "Ответ на запрос пользователя",
    };
    return descriptions[requestType] || "Обработка запроса";
  };

  // Вспомогательная функция для безопасного получения поля checkedFields
  const getCheckedField = (
    field: keyof ValidationResponse["checkedFields"]
  ): boolean => {
    if (!validationResult?.checkedFields) return false;
    const value = validationResult.checkedFields[field];
    return typeof value === "boolean" ? value : false;
  };

  // Рендерим зашифрованные данные с результатами проверки
  const renderEncryptedData = () => {
    if (!selectedRequest) return null;

    const isValid = validationResult?.isValid || false;
    const hasErrors =
      validationResult?.errors && validationResult.errors.length > 0;
    const checkedFields = validationResult?.checkedFields;

    return (
      <div className="support-modal-encrypted">
        {/* Основная информация о запросе */}
        <div className="support-modal-section">
          <h4>
            {getRequestTypeIcon()} {getRequestTypeName()}
          </h4>
          <p className="system-info">{getRequestTypeDescription()}</p>

          <div className="encrypted-data-grid">
            <div className="encrypted-data-item">
              <span className="encrypted-label">ID запроса:</span>
              <span className="encrypted-value">
                {selectedRequest.publicId}
              </span>
            </div>
            <div className="encrypted-data-item">
              <span className="encrypted-label">Логин пользователя:</span>
              <span className="encrypted-value">{selectedRequest.login}</span>
            </div>
            <div className="encrypted-data-item">
              <span className="encrypted-label">Email в запросе:</span>
              <span className="encrypted-value">{selectedRequest.email}</span>
            </div>
            <div className="encrypted-data-item">
              <span className="encrypted-label">Статус:</span>
              <span
                className={`encrypted-status status-${selectedRequest.status}`}
              >
                {selectedRequest.status === "pending" && "Ожидает"}
                {selectedRequest.status === "confirmed" && "Подтвержден"}
                {selectedRequest.status === "in_progress" && "В работе"}
                {selectedRequest.status === "completed" && "Завершен"}
                {selectedRequest.status === "rejected" && "Отклонен"}
                {selectedRequest.status === "expired" && "Просрочен"}
              </span>
            </div>
            <div className="encrypted-data-item">
              <span className="encrypted-label">Дата создания:</span>
              <span className="encrypted-value">
                {new Date(selectedRequest.createdAt).toLocaleString("ru-RU")}
              </span>
            </div>
            {selectedRequest.isOverdue && (
              <div className="encrypted-data-item overdue">
                <span className="encrypted-label">⚠️ Срок обработки:</span>
                <span className="encrypted-value">Просрочен (`{">"}`24ч)</span>
              </div>
            )}
            {selectedRequest.newEmail && (
              <div className="encrypted-data-item full-width">
                <span className="encrypted-label">Новый email (запрошен):</span>
                <span className="encrypted-value">
                  {selectedRequest.newEmail}
                </span>
              </div>
            )}
            {selectedRequest.message && (
              <div className="encrypted-data-item full-width">
                <span className="encrypted-label">Сообщение пользователя:</span>
                <div className="encrypted-message">
                  {selectedRequest.message}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Результаты автоматической проверки */}
        {validationResult && (
          <div className="support-modal-section">
            <h4>🔍 Результаты проверки данных</h4>

            <div
              className={`validation-header ${isValid ? "valid" : "invalid"}`}
            >
              <h4>
                {isValid ? "✅ Все проверки пройдены" : "❌ Обнаружены ошибки"}
              </h4>
            </div>

            <div className="validation-results">
              <div className="validation-item">
                <span className="validation-label">Логин пользователя:</span>
                <span
                  className={`validation-status ${
                    getCheckedField("login") ? "success" : "error"
                  }`}
                >
                  {getCheckedField("login") ? "✓ Существует" : "✗ Не найден"}
                </span>
              </div>

              <div className="validation-item">
                <span className="validation-label">Email (совпадение):</span>
                <span
                  className={`validation-status ${
                    getCheckedField("email") === true
                      ? "success"
                      : getCheckedField("email") === false
                      ? "error"
                      : "neutral"
                  }`}
                >
                  {getCheckedField("email") === true
                    ? "✓ Совпадает"
                    : getCheckedField("email") === false
                    ? "✗ Не совпадает"
                    : "— Не проверялось"}
                </span>
              </div>

              <div className="validation-item">
                <span className="validation-label">Секретное слово:</span>
                <span
                  className={`validation-status ${
                    getCheckedField("secretWord") === true
                      ? "success"
                      : getCheckedField("secretWord") === false
                      ? "error"
                      : "neutral"
                  }`}
                >
                  {getCheckedField("secretWord") === true
                    ? "✓ Совпадает"
                    : getCheckedField("secretWord") === false
                    ? "✗ Не совпадает"
                    : requestType === "other"
                    ? "— Не проверялось"
                    : "⚠️ Не проверено"}
                </span>
              </div>

              {checkedFields && checkedFields.password !== null && (
                <div className="validation-item">
                  <span className="validation-label">Пароль:</span>
                  <span
                    className={`validation-status ${
                      checkedFields.password === true ? "success" : "error"
                    }`}
                  >
                    {checkedFields.password === true
                      ? "✓ Совпадает"
                      : "✗ Не совпадает"}
                  </span>
                </div>
              )}

              {hasErrors && (
                <div className="validation-errors">
                  <h5>❌ Обнаруженные ошибки:</h5>
                  <ul>
                    {validationResult.errors!.map(
                      (error: string, index: number) => (
                        <li key={index}>{error}</li>
                      )
                    )}
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
          </div>
        )}

        {/* Поле для ответа (только для типа "other") */}
        {selectedRequest.type === "other" && (
          <div className="support-modal-section">
            <h4>✍️ Ответ пользователю</h4>
            <textarea
              value={emailResponse}
              onChange={(e) => setEmailResponse(e.target.value)}
              placeholder="Напишите ответ пользователю..."
              className="rejection-textarea"
              rows={4}
            />
            <div className="rejection-hint">
              Этот ответ будет отправлен пользователю на email
            </div>
          </div>
        )}

        {/* Поле для причины отказа (если есть ошибки) */}
        {hasErrors && !isValid && (
          <div className="support-modal-section">
            <h5>📝 Причина отказа:</h5>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Опишите причину отказа пользователю..."
              className="rejection-textarea"
              rows={3}
            />
            <div className="rejection-hint">
              Это сообщение будет отправлено пользователю на email
            </div>
          </div>
        )}

        {/* Информационное сообщение */}
        <div className="support-modal-section">
          <h4>🔐 Системная информация</h4>
          <p className="system-info">
            {isValid
              ? "✅ Все проверки пройдены успешно. Вы можете выполнить действие."
              : hasErrors
              ? "❌ Обнаружены ошибки при проверке данных. Вы можете отклонить запрос."
              : "Данные пользователя зашифрованы. Проверка выполнена автоматически."}
          </p>
          <p className="system-warning">
            ⚠️ При выполнении действия система отправит письмо на email
            пользователя из базы данных.
          </p>
        </div>
      </div>
    );
  };

  // Рендерим подтверждение действия
  const renderConfirmation = () => {
    if (!selectedRequest) return null;

    const actionNames: Record<string, string> = {
      password_reset: "сбросить пароль (отправить ссылку)",
      email_change: "сменить email",
      unblock: "разблокировать аккаунт",
      account_deletion: "удалить аккаунт",
      other: "отправить ответ пользователю",
    };

    const warningMessages: Record<string, string> = {
      password_reset:
        "Пользователю будет отправлена ссылка для установки нового пароля.",
      email_change:
        "Email будет изменен. Письмо отправлено на старый и новый адрес.",
      unblock:
        "Аккаунт будет разблокирован. Пользователь сможет войти в систему.",
      account_deletion:
        "Аккаунт будет БЕЗВОЗВРАТНО удален вместе со всеми данными.",
      other: "Ответ будет отправлен пользователю на email.",
    };

    return (
      <div className="support-modal-confirm">
        <div className="confirm-header">
          <h4>⚠️ Подтверждение действия</h4>
        </div>

        <div className="confirm-content">
          <div className="confirm-icon">⚡</div>
          <div className="confirm-message">
            Вы собираетесь <strong>{actionNames[selectedRequest.type]}</strong>{" "}
            для пользователя:
          </div>

          <div className="confirm-user-info">
            <div className="confirm-user-item">
              <span className="confirm-label">👤 Логин:</span>
              <span className="confirm-value">{user.login}</span>
            </div>
            <div className="confirm-user-item">
              <span className="confirm-label">✉️ Email в системе:</span>
              <span className="confirm-value">{user.email}</span>
            </div>
            <div className="confirm-user-item">
              <span className="confirm-label">🆔 Запрос:</span>
              <span className="confirm-value">{selectedRequest.publicId}</span>
            </div>
            <div className="confirm-user-item">
              <span className="confirm-label">📋 Тип:</span>
              <span className="confirm-value">{getRequestTypeName()}</span>
            </div>
          </div>

          <div className="confirm-warning">
            <div className="warning-icon">❗</div>
            <div className="warning-text">
              {warningMessages[selectedRequest.type]}
              {selectedRequest.type === "account_deletion" &&
                " Это действие НЕОБРАТИМО."}
              {selectedRequest.type === "email_change" &&
                " Потребуется повторная активация аккаунта."}
            </div>
          </div>

          {selectedRequest.type === "other" && emailResponse && (
            <div className="confirm-user-item full-width">
              <span className="confirm-label">📝 Ваш ответ:</span>
              <div className="encrypted-message">{emailResponse}</div>
            </div>
          )}
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
              {getRequestTypeIcon()} {getRequestTypeName()}
            </h3>
            <div className="support-modal-subtitle">
              Пользователь: <strong>{user.login}</strong>
              {requests.length > 1 && (
                <span className="requests-count">
                  {" "}
                  ({requests.length} запросов)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="support-modal-close"
            disabled={isProcessing || state === "validating"}
            title="Закрыть"
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
          {state === "loading" && (
            <div className="support-modal-loading">
              <div className="loading-spinner">⏳</div>
              <p>Загрузка запросов...</p>
            </div>
          )}

          {/* Состояние проверки */}
          {state === "validating" && (
            <div className="support-modal-loading">
              <div className="loading-spinner">🔍</div>
              <p>Проверка данных...</p>
              <p className="loading-subtext">
                Система проверяет зашифрованные данные пользователя
              </p>
            </div>
          )}

          {/* Зашифрованные данные с результатами проверки */}
          {state === "encrypted" && renderEncryptedData()}

          {/* Подтверждение действия */}
          {state === "confirm" && renderConfirmation()}
        </div>

        {/* Футер модального окна */}
        <div className="support-modal-footer">
          {/* Кнопки для состояния с результатами проверки */}
          {state === "encrypted" && validationResult && (
            <>
              {validationResult.isValid ? (
                // Все проверки пройдены - можно выполнить
                <>
                  <button
                    onClick={() => setState("confirm")}
                    className="support-modal-button approve-button"
                    disabled={
                      isProcessing ||
                      (selectedRequest?.type === "other" &&
                        !emailResponse.trim())
                    }
                  >
                    ✅ Выполнить
                  </button>
                  <button
                    onClick={onClose}
                    className="support-modal-button cancel-button"
                    disabled={isProcessing}
                  >
                    ❌ Отменить
                  </button>
                </>
              ) : (
                // Есть ошибки - можно только отклонить
                <>
                  <button
                    onClick={handleReject}
                    className="support-modal-button reject-button"
                    disabled={isProcessing || !rejectReason.trim()}
                  >
                    ❌ Отклонить
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
            </>
          )}

          {/* Кнопки для подтверждения действия */}
          {state === "confirm" && (
            <>
              <button
                onClick={handleApprove}
                className="support-modal-button confirm-approve-button"
                disabled={isProcessing}
              >
                {isProcessing ? "⏳ Выполняю..." : "✅ Подтвердить"}
              </button>
              <button
                onClick={() => setState("encrypted")}
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

SupportRequestModal.displayName = "SupportRequestModal";
export default SupportRequestModal;
