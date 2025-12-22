import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { RegisterCredentials } from '../../types/api.types';
import './RegisterForm.css'; 

interface RegisterFormProps {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  redirectOnSuccess?: boolean;
}

// Создаем локальный тип для формы
interface RegisterFormData extends RegisterCredentials {
  confirmPassword: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onError,
  redirectOnSuccess = true
}) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    login: '',
    password: '',
    email: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
  const navigate = useNavigate();
  const { register } = useAuth();


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Валидация логина
    if (!formData.login.trim()) {
      newErrors.login = 'Логин обязателен';
    } else if (formData.login.length < 4) {
      newErrors.login = 'Логин должен быть не менее 4 символов';
    } else if (formData.login.length > 20) {
      newErrors.login = 'Логин должен быть не более 20 символов';
    }

    // Валидация email
    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Введите корректный email';
    }

    // Валидация пароля
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Пароль должен содержать заглавные, строчные буквы и цифры';
    }

    // Подтверждение пароля
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Подтвердите пароль';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  };

  const getPasswordStrengthText = (strength: 'weak' | 'medium' | 'strong'): string => {
    switch (strength) {
      case 'weak': return 'Слабый';
      case 'medium': return 'Средний';
      case 'strong': return 'Сильный';
      default: return '';
    }
  };

  const getPasswordStrengthClass = (strength: 'weak' | 'medium' | 'strong'): string => {
    switch (strength) {
      case 'weak': return 'password-weak';
      case 'medium': return 'password-medium';
      case 'strong': return 'password-strong';
      default: return '';
    }
  };

 const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setFormData((prev: RegisterFormData) => ({
    ...prev,
    [name]: value
  }));
  
  // Проверка силы пароля
  if (name === 'password') {
    setPasswordStrength(checkPasswordStrength(value));
  }
  
  // Очищаем ошибку при изменении поля
  if (errors[name]) {
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  }
};

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {     
      
      const result = await register(
      formData.login,
      formData.password,
      formData.email
    );

      if (result.success) {
        // Успешная регистрация
        if (onSuccess) {
          onSuccess();
        }
        
        if (redirectOnSuccess) {
          navigate('/register-success', { 
            state: { 
              email: formData.email,
              login: formData.login
            } 
          });
        }
      } else {
        // Ошибка регистрации
        const errorMessage = result.message || 'Ошибка регистрации';
        setErrors({ submit: errorMessage });
        
        if (onError) {
          onError(errorMessage);
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Произошла ошибка';
      setErrors({ submit: errorMessage });
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleTermsClick = () => {
    // TODO: Открыть модальное окно с условиями
    alert('Условия использования будут отображены в модальном окне');
  };

  return (
    <div className="auth-form-container">
      <div className="auth-header">
        <h3>Регистрация в системе</h3>
        <p className="auth-subtitle">Создайте аккаунт для доступа к диагностической системе</p>
      </div>
      
      {errors.submit && (
        <div className="upload-message upload-error">
          <i className="fas fa-exclamation-circle"></i>
          {errors.submit}
        </div>
      )}
      
      <form 
        className="formForAuth" 
        onSubmit={handleSubmit} 
        data-form="register"
        noValidate
      >
        <div className="fields">
          <label htmlFor="register-login">
            <i className="fas fa-user"></i> Логин:
          </label>
          <div className="input-wrapper">
            <input 
              id="register-login"
              className={`input ${errors.login ? 'errors' : ''}`}
              type="text"
              placeholder="Придумайте логин (4-20 символов)"
              name="login"
              value={formData.login}
              onChange={handleChange}
              data-input="register-login"
              disabled={isLoading}
              autoComplete="username"
              autoFocus
            />
            {errors.login && (
              <span className="input-error">
                <i className="fas fa-exclamation-triangle"></i> {errors.login}
              </span>
            )}
          </div>
        </div>
        
        <div className="fields">
          <label htmlFor="register-email">
            <i className="fas fa-envelope"></i> Email:
          </label>
          <div className="input-wrapper">
            <input 
              id="register-email"
              className={`input ${errors.email ? 'errors' : ''}`}
              type="email"
              placeholder="Введите ваш email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              data-input="register-email"
              disabled={isLoading}
              autoComplete="email"
            />
            {errors.email && (
              <span className="input-error">
                <i className="fas fa-exclamation-triangle"></i> {errors.email}
              </span>
            )}
          </div>
        </div>
        
        <div className="fields">
          <label htmlFor="register-password">
            <i className="fas fa-lock"></i> Пароль:
          </label>
          <div className="input-wrapper">
            <input 
              id="register-password"
              className={`input ${errors.password ? 'errors' : ''}`}
              type="password"
              placeholder="Придумайте пароль (мин. 6 символов)"
              name="password"
              value={formData.password}
              onChange={handleChange}
              data-input="register-password"
              disabled={isLoading}
              autoComplete="new-password"
            />
            {formData.password && (
              <div className={`password-strength ${getPasswordStrengthClass(passwordStrength)}`}>
                <div className="strength-bar">
                  <div 
                    className="strength-fill" 
                    style={{ 
                      width: passwordStrength === 'weak' ? '33%' : 
                             passwordStrength === 'medium' ? '66%' : '100%' 
                    }}
                  ></div>
                </div>
                <span className="strength-text">
                  Сложность: {getPasswordStrengthText(passwordStrength)}
                </span>
              </div>
            )}
            {errors.password && (
              <span className="input-error">
                <i className="fas fa-exclamation-triangle"></i> {errors.password}
              </span>
            )}
          </div>
        </div>
        
        <div className="fields">
          <label htmlFor="register-confirm-password">
            <i className="fas fa-lock"></i> Подтверждение пароля:
          </label>
          <div className="input-wrapper">
            <input 
              id="register-confirm-password"
              className={`input ${errors.confirmPassword ? 'errors' : ''}`}
              type="password"
              placeholder="Повторите пароль"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              data-input="register-confirm-password"
              disabled={isLoading}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <span className="input-error">
                <i className="fas fa-exclamation-triangle"></i> {errors.confirmPassword}
              </span>
            )}
            {formData.password && formData.confirmPassword && 
             formData.password === formData.confirmPassword && (
              <span className="input-success">
                <i className="fas fa-check-circle"></i> Пароли совпадают
              </span>
            )}
          </div>
        </div>
        
        <div className="form-terms">
          <label className="checkbox-label">
            <input type="checkbox" required />
            <span>
              Я соглашаюсь с{' '}
              <button 
                type="button" 
                className="terms-link"
                onClick={handleTermsClick}
              >
                условиями использования
              </button>{' '}
              и политикой конфиденциальности
            </span>
          </label>
        </div>
        
        <div className="form-actions">
          <button 
            className="buttonFromTemplate" 
            type="submit"
            data-button="register"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Регистрация...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus"></i> Зарегистрироваться
              </>
            )}
          </button>
        </div>
      </form>
      
      <div className="auth-links">
        <div className="auth-divider">
          <span>Уже есть аккаунт?</span>
        </div>
        
        <div className="auth-options">
          <button 
            className="upload-button" 
            type="button"
            onClick={handleLoginClick}
            disabled={isLoading}
          >
            <i className="fas fa-sign-in-alt"></i> Войти в систему
          </button>
        </div>
      </div>
      
      <div className="auth-info">
        <p>
          <i className="fas fa-info-circle"></i> 
          После регистрации вам будет отправлено письмо для подтверждения email.
          Без подтверждения email вход в систему невозможен.
        </p>
        <p>
          <i className="fas fa-shield-alt"></i> 
          Ваши данные защищены и используются только для предоставления медицинских услуг.
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;