/**
 * Типы для формы входа (логина)
 */

// Тип для данных формы входа
export interface LoginFormData {
  login: string;
  password: string;
}

// Тип для ошибок формы входа
export interface LoginFormErrors {
  login?: string;
  password?: string;
  submit?: string;
}

// Пропсы компонента LoginForm
export interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  redirectOnSuccess?: boolean;
}

// Результат валидации формы входа
export interface LoginValidationResult {
  isValid: boolean;
  errors: LoginFormErrors;
}

// События изменения формы входа
export interface LoginFormChangeEvent {
  name: keyof LoginFormData;
  value: string;
}