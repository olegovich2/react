/**
 * Типы для формы регистрации
 */

// Тип для данных формы регистрации
export interface RegisterFormData {
  login: string;
  password: string;
  email: string;
  confirmPassword: string;
  secretWord: string;
}

// Тип для ошибок формы
export interface RegisterFormErrors {
  login?: string;
  password?: string;
  email?: string;
  confirmPassword?: string;
  submit?: string;
}

// Сила пароля
export type PasswordStrength = 'weak' | 'medium' | 'strong';

// Пропсы компонента RegisterForm
export interface RegisterFormProps {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  redirectOnSuccess?: boolean;
}

// Результат валидации формы
export interface RegisterValidationResult {
  isValid: boolean;
  errors: RegisterFormErrors;
}

// События изменения формы
export interface RegisterFormChangeEvent {
  name: keyof RegisterFormData;
  value: string;
}