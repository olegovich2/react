import React, {
  useState,
  FormEvent,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  supportApi,
  SupportRequestData,
  RequestType,
} from "../../../api/support.api";
import "./SupportForm.css";

// Локальные типы
interface SupportFormData {
  type: string;
  login: string;
  email: string;
  secretWord: string;
  password: string;
  message: string;
  newEmail?: string;
}

interface SupportFormProps {
  onSuccess?: (data: { requestId: string; email: string }) => void;
  onError?: (message: string) => void;
}

// Тип для успешных данных
interface SupportSuccessData {
  requestId: string;
  email: string;
  note?: string;
}

const SupportForm: React.FC<SupportFormProps> = ({ onSuccess, onError }) => {
  // Состояния формы
  const [formData, setFormData] = useState<SupportFormData>({
    type: "",
    login: "",
    email: "",
    secretWord: "",
    password: "",
    message: "",
    newEmail: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<SupportSuccessData | null>(
    null
  );
  const [showPassword, setShowPassword] = useState(false);

  // Типы заявок
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);

  // Ref для защиты от многократной отправки
  const isSubmittingRef = useRef(false);

  // Инициализация при загрузке
  useEffect(() => {
    const types = supportApi.getRequestTypes();
    setRequestTypes(types);

    // Автовыбор первого типа
    if (types.length > 0) {
      setFormData((prev) => ({
        ...prev,
        type: types[0].value,
      }));
    }
  }, []);

  // Определяем, какие поля показывать для текущего типа
  const visibleFields = useMemo(() => {
    const fields = {
      showEmail: true, // Email всегда показываем для всех типов заявок
      showSecretWord: true,
      showPassword: false,
      showNewEmail: false,
    };

    switch (formData.type) {
      case "password_reset":
        fields.showPassword = false;
        fields.showNewEmail = false;
        fields.showSecretWord = true;
        break;

      case "email_change":
        fields.showPassword = true;
        fields.showNewEmail = true;
        fields.showSecretWord = true;
        break;

      case "unblock":
        fields.showPassword = true;
        fields.showNewEmail = false;
        fields.showSecretWord = true;
        break;

      case "account_deletion":
        fields.showPassword = true;
        fields.showNewEmail = false;
        fields.showSecretWord = true;
        break;

      case "other":
        fields.showPassword = false;
        fields.showNewEmail = false;
        fields.showSecretWord = false; // Для "другой проблемы" кодовое слово не нужно
        break;

      default:
        break;
    }

    return fields;
  }, [formData.type]);

  // ВАЛИДАЦИЯ
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // 1. Тип проблемы
    if (!formData.type) {
      newErrors.type = "Выберите тип проблемы";
    }

    // 2. Логин (минимум 3 символа)
    if (!formData.login.trim()) {
      newErrors.login = "Логин обязателен";
    } else if (formData.login.length < 3) {
      newErrors.login = "Логин должен быть не менее 3 символов";
    }

    // 3. Email (ВСЕГДА ОБЯЗАТЕЛЕН для подтверждения заявки)
    if (!formData.email.trim()) {
      newErrors.email = "Email обязателен для отправки подтверждения";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Введите корректный email";
    }

    // 4. Кодовое слово (только если нужно показывать)
    if (visibleFields.showSecretWord) {
      if (!formData.secretWord.trim()) {
        newErrors.secretWord = "Кодовое слово обязательно";
      } else if (formData.secretWord.length < 3) {
        newErrors.secretWord = "Кодовое слово должно быть не менее 3 символов";
      }
    }

    // 5. Пароль (только если нужно показывать)
    if (visibleFields.showPassword) {
      if (!formData.password.trim()) {
        newErrors.password = "Пароль обязателен";
      } else if (formData.password.length < 6) {
        newErrors.password = "Пароль должен быть не менее 6 символов";
      }
    }

    // 6. Сообщение (минимум 10 символов)
    if (!formData.message.trim()) {
      newErrors.message = "Опишите вашу проблему";
    } else if (formData.message.length < 10) {
      newErrors.message = "Опишите проблему подробнее (минимум 10 символов)";
    }

    // 7. Новый email (только для смены email)
    if (formData.type === "email_change") {
      if (!formData.newEmail?.trim()) {
        newErrors.newEmail = "Укажите новый email";
      } else if (!emailRegex.test(formData.newEmail)) {
        newErrors.newEmail = "Некорректный новый email";
      } else if (formData.newEmail === formData.email) {
        newErrors.newEmail = "Новый email должен отличаться от текущего";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, visibleFields]);

  // ОБРАБОТЧИКИ
  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      // Очищаем ошибку при изменении поля
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    },
    [errors]
  );

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();

    // 🔒 ЗАЩИТА ОТ МНОГОКРАТНОЙ ОТПРАВКИ
    if (isSubmittingRef.current) {
      console.warn('⚠️ [SupportForm] Форма уже отправляется! Игнорируем повторный запрос.');
      return;
    }

    if (isLoading) {
      console.warn('⚠️ [SupportForm] Уже идет отправка!');
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Устанавливаем флаг отправки
    isSubmittingRef.current = true;
    setIsLoading(true);
    setErrors({});

    console.log('🚀 [SupportForm] ОТПРАВКА НАЧАТА (только один раз!)');

    try {
      // Подготавливаем данные для отправки
      const requestData: SupportRequestData = {
        type: formData.type,
        login: formData.login,
        email: formData.email,
        secretWord: formData.secretWord || '',
        message: formData.message,
        // Добавляем пароль, если поле отображается и оно заполнено
        ...(visibleFields.showPassword && formData.password && { 
          password: formData.password 
        }),
        // Добавляем новый email для смены email
        ...(formData.type === 'email_change' && { 
          newEmail: formData.newEmail 
        })
      };

      console.log('📨 [SupportForm] Отправляемые данные:', {
        ...requestData,
        password: requestData.password ? '***' : 'не указан',
        secretWord: requestData.secretWord ? '***' : 'не указан'
      });

      const response = await supportApi.submitRequest(requestData);

      console.log('📨 [SupportForm] Ответ от API:', {
        success: response.success,
        hasData: !!response.data,
        apiSuccess: response.data?.success,
        apiMessage: response.data?.message
      });

      // Проверяем ответ
      if (response.success && response.data?.success && response.data.data) {
        const apiData = response.data.data;

        console.log('✅ [SupportForm] Данные из API:', apiData);

        const successData: SupportSuccessData = {
          requestId: apiData.requestId,
          email: apiData.email,
          note: apiData.note
        };

        // Устанавливаем состояние
        setSubmittedData(successData);
        setIsSubmitted(true);

        if (onSuccess) {
          onSuccess(successData);
        }
      } else {
        // ОШИБКА ОТ СЕРВЕРА
        const errorMessage = response.data?.message || response.message || 'Ошибка при отправке заявки';
        console.error('❌ [SupportForm] Ошибка:', errorMessage);
        setErrors({ submit: errorMessage });

        if (onError) {
          onError(errorMessage);
        }
      }
    } catch (error: any) {
      // СЕТЕВАЯ ОШИБКА
      const errorMessage = error.message || 'Произошла ошибка сети';
      console.error('❌ [SupportForm] Исключение:', errorMessage);
      setErrors({ submit: errorMessage });

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      // Сбрасываем флаг отправки
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  }, [formData, visibleFields, validateForm, onSuccess, onError, isLoading]);

  // Кнопка "Перейти на почту"
  const handleGoToEmail = useCallback(() => {
    if (submittedData?.email) {
      console.log("📧 [SupportForm] Открытие почты для:", submittedData.email);

      const provider = supportApi.getEmailProvider(submittedData.email);
      console.log("📧 [SupportForm] Почтовый провайдер:", provider.name);

      supportApi.openEmailClient(submittedData.email);
    } else {
      console.error("❌ [SupportForm] Email не указан");
      alert("Email не указан");
    }
  }, [submittedData]);

  // Кнопка "Новая заявка" (после успешной отправки)
  const handleNewRequest = useCallback(() => {
    // Сбрасываем флаг отправки
    isSubmittingRef.current = false;

    setFormData({
      type: requestTypes[0]?.value || "",
      login: "",
      email: "",
      secretWord: "",
      password: "",
      message: "",
      newEmail: "",
    });
    setSubmittedData(null);
    setIsSubmitted(false);
    setErrors({});
    setShowPassword(false);
  }, [requestTypes]);

  // Тоггл показа пароля
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // РЕНДЕР ПОЛЯ С ПОДСКАЗКОЙ
  const renderField = useCallback(
    (
      label: string,
      name: keyof SupportFormData,
      type: string = "text",
      placeholder: string = "",
      hint: string = "",
      isPassword: boolean = false,
      required: boolean = true
    ) => {
      const isError = errors[name];
      const value = formData[name] as string;

      return (
        <div className="support-form-field">
          <label htmlFor={`support-${name}`}>
            {label}
            {required && <span className="required-asterisk">*</span>}
          </label>
          <div className="support-input-wrapper">
            {isPassword ? (
              <div className="support-password-container">
                <input
                  id={`support-${name}`}
                  className={`support-input ${
                    isError ? "support-input-error" : ""
                  }`}
                  type={showPassword ? "text" : "password"}
                  name={name}
                  value={value}
                  onChange={handleChange}
                  placeholder={placeholder}
                  disabled={isLoading}
                  autoComplete="current-password"
                  required={required}
                />
                <button
                  type="button"
                  className="support-show-password"
                  onClick={togglePasswordVisibility}
                  title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  disabled={isLoading}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            ) : type === "textarea" ? (
              <textarea
                id={`support-${name}`}
                className={`support-input ${
                  isError ? "support-input-error" : ""
                }`}
                name={name}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={isLoading}
                rows={5}
                required={required}
              />
            ) : (
              <input
                id={`support-${name}`}
                className={`support-input ${
                  isError ? "support-input-error" : ""
                }`}
                type={type}
                name={name}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={isLoading}
                required={required}
              />
            )}
            {hint && <div className="support-field-hint">{hint}</div>}
            {isError && (
              <div className="support-error-message">
                <i className="fas fa-exclamation-triangle"></i> {isError}
              </div>
            )}
          </div>
        </div>
      );
    },
    [
      formData,
      errors,
      isLoading,
      showPassword,
      handleChange,
      togglePasswordVisibility,
    ]
  );

  // ==================== РЕНДЕР ====================

  // Если заявка уже отправлена
  if (isSubmitted && submittedData) {
    console.log("🏆 [SupportForm] Рендерим успешное состояние:", submittedData);

    // Получаем информацию о почтовом провайдере
    const emailProvider = submittedData.email
      ? supportApi.getEmailProvider(submittedData.email)
      : { name: "почтовый сервис", url: "" };

    return (
      <div className="support-success-container">
        <div className="support-success-icon">
          <i className="fas fa-check-circle"></i>
        </div>

        <h2 className="support-success-title">✅ Заявка успешно создана!</h2>

        <div className="support-success-info">
          <p>
            <strong>Номер заявки:</strong> {submittedData.requestId}
          </p>
          <p>
            <strong>Email для подтверждения:</strong> {submittedData.email}
          </p>
          {submittedData.note && (
            <p style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
              <i className="fas fa-info-circle"></i> {submittedData.note}
            </p>
          )}
        </div>

        <div className="support-success-instructions">
          <h3>📋 Что делать дальше:</h3>
          <ol>
            <li>
              Проверьте почту <strong>{submittedData.email}</strong>
            </li>
            <li>
              Найдите письмо от QuickDiagnosis с темой "Заявка в техподдержку"
            </li>
            <li>Нажмите на ссылку в письме для подтверждения заявки</li>
            <li>
              После подтверждения специалист начнет работу над вашей проблемой
            </li>
          </ol>
        </div>

        <div className="support-success-actions">
          <button
            className="support-button-primary support-email-button"
            onClick={handleGoToEmail}
            type="button"
            title={`Открыть ${emailProvider.name}`}
          >
            <i className="fas fa-envelope"></i> Перейти на почту
            {emailProvider.name && emailProvider.name !== "почтовый сервис" && (
              <span className="email-provider-badge">
                {" "}
                ({emailProvider.name})
              </span>
            )}
          </button>

          <button
            className="support-button-secondary"
            onClick={handleNewRequest}
            type="button"
          >
            <i className="fas fa-plus"></i> Создать новую заявку
          </button>
        </div>

        <div className="support-success-note">
          <p>
            <i className="fas fa-info-circle"></i>
            Если вы не видите письмо, проверьте папку "Спам" или "Рассылки".
          </p>
          {emailProvider.url && (
            <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              <i className="fas fa-external-link-alt"></i> Ссылка откроется в
              новой вкладке
            </p>
          )}
        </div>
      </div>
    );
  }

  // Основная форма
  return (
    <div className="support-form-container">
      <div className="support-form-header">
        <h3>📝 Форма обращения в техподдержку</h3>
        <p className="support-form-subtitle">
          Заполните все поля для быстрого решения вашей проблемы
        </p>
      </div>

      {errors.submit && (
        <div className="support-form-message support-form-error">
          <i className="fas fa-exclamation-circle"></i>
          {errors.submit}
        </div>
      )}

      <form className="support-form" onSubmit={handleSubmit} noValidate>
        {/* 1. ТИП ПРОБЛЕМЫ */}
        <div className="support-form-field">
          <label htmlFor="support-type">
            Тип проблемы<span className="required-asterisk">*</span>
          </label>
          <div className="support-input-wrapper">
            <select
              id="support-type"
              className={`support-input support-select ${
                errors.type ? "support-input-error" : ""
              }`}
              name="type"
              value={formData.type}
              onChange={handleChange}
              disabled={isLoading}
              required
            >
              {requestTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <div className="support-field-hint">
              Выберите наиболее подходящую категорию вашей проблемы
            </div>
            {errors.type && (
              <div className="support-error-message">
                <i className="fas fa-exclamation-triangle"></i> {errors.type}
              </div>
            )}
          </div>
        </div>

        {/* 2. ЛОГИН (ВСЕГДА ПОКАЗЫВАЕТСЯ) */}
        {renderField(
          "Логин",
          "login",
          "text",
          "Введите ваш логин в системе QuickDiagnosis",
          "Тот же логин, который вы используете для входа в систему",
          false,
          true
        )}

        {/* 3. EMAIL (ВСЕГДА ПОКАЗЫВАЕТСЯ ДЛЯ ПОДТВЕРЖДЕНИЯ) */}
        {renderField(
          "Email",
          "email",
          "email",
          "example@email.com",
          "Email для связи и подтверждения заявки",
          false,
          true
        )}

        {/* 4. КОДОВОЕ СЛОВО (ВСЕГДА КРОМЕ "ДРУГОЙ ПРОБЛЕМЫ") */}
        {visibleFields.showSecretWord &&
          renderField(
            "Кодовое слово",
            "secretWord",
            "text",
            "Введите ваше кодовое слово",
            "Ваше кодовое слово, которое вы писали при регистрации",
            false,
            true
          )}

        {/* 5. ПАРОЛЬ (ТОЛЬКО ДЛЯ НЕКОТОРЫХ ТИПОВ) */}
        {visibleFields.showPassword &&
          renderField(
            "Пароль",
            "password",
            "password",
            "Введите ваш текущий пароль",
            "Текущий пароль от вашего аккаунта (для подтверждения)",
            true,
            true
          )}

        {/* 6. НОВЫЙ EMAIL (ТОЛЬКО ДЛЯ СМЕНЫ EMAIL) */}
        {formData.type === "email_change" &&
          renderField(
            "Новый email",
            "newEmail",
            "email",
            "new@example.com",
            "Email, на который вы хотите сменить текущий",
            false,
            true
          )}

        {/* 7. СООБЩЕНИЕ (ВСЕГДА) */}
        {renderField(
          "Сообщение",
          "message",
          "textarea",
          "Опишите вашу проблему максимально подробно...",
          "Чем подробнее вы опишете проблему, тем быстрее мы сможем помочь",
          false,
          true
        )}

        {/* КНОПКА ОТПРАВКИ */}
        <div className="support-form-actions">
          <button
            className="support-button-primary"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Отправка...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i> Отправить заявку
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

SupportForm.displayName = "SupportForm";

export default SupportForm;