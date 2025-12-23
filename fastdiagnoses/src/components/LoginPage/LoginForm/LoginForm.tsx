import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { LoginFormData, LoginFormProps } from '../types/login.types';
import './LoginForm.css';

const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  redirectOnSuccess = true
}) => {
  const [formData, setFormData] = useState<LoginFormData>({
    login: '',
    password: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.login.trim()) {
      newErrors.login = 'Логин обязателен';
    }

    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
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
      const result = await login(formData.login, formData.password);

      if (result.success) {
        // Успешный вход
        if (onSuccess) {
          onSuccess();
        }
        
        if (redirectOnSuccess) {
          navigate('/');
        }
      } else {
        // Ошибка входа
        const errorMessage = result.message || 'Ошибка входа';
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

  const handleRegisterClick = () => {
    navigate('/register');
  };

  const handleForgotPassword = () => {
    // TODO: Реализовать восстановление пароля
    alert('Функция восстановления пароля в разработке');
  };

  return (
    <div className="login-form-container">
      <div className="login-form-header">
        <h3>Вход в систему</h3>
        <p className="login-form-subtitle">Для входа введите ваш логин и пароль</p>
      </div>
      
      {errors.submit && (
        <div className="login-form-message login-form-error">
          <i className="fas fa-exclamation-circle"></i>
          {errors.submit}
        </div>
      )}
      
      <form 
        className="login-form-for-auth" 
        onSubmit={handleSubmit} 
        data-form="entry"
        noValidate
      >
        <div className="login-form-fields">
          <label htmlFor="login">
            <i className="fas fa-user"></i> Логин:
          </label>
          <div className="login-form-input-wrapper">
            <input 
              id="login"
              className={`login-form-input ${errors.login ? 'errors' : ''}`}
              type="text"
              placeholder="Введите ваш логин"
              name="login"
              value={formData.login}
              onChange={handleChange}
              data-input="login"
              disabled={isLoading}
              autoComplete="username"
              autoFocus
            />
            {errors.login && (
              <span className="login-form-input-error">
                <i className="fas fa-exclamation-triangle"></i> {errors.login}
              </span>
            )}
          </div>
        </div>
        
        <div className="login-form-fields">
          <label htmlFor="password">
            <i className="fas fa-lock"></i> Пароль:
          </label>
          <div className="login-form-input-wrapper">
            <input 
              id="password"
              className={`login-form-input ${errors.password ? 'errors' : ''}`}
              type="password"
              placeholder="Введите ваш пароль"
              name="password"
              value={formData.password}
              onChange={handleChange}
              data-input="pass"
              disabled={isLoading}
              autoComplete="current-password"
            />
            {errors.password && (
              <span className="login-form-input-error">
                <i className="fas fa-exclamation-triangle"></i> {errors.password}
              </span>
            )}
          </div>
        </div>
        
        <div className="login-form-actions">
          <button 
            className="login-form-button-primary" 
            type="submit"
            data-button="entry"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Вход...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i> Войти
              </>
            )}
          </button>
          
          <button 
            className="login-form-button-secondary" 
            type="button"
            onClick={handleForgotPassword}
            disabled={isLoading}
          >
            <i className="fas fa-question-circle"></i> Забыли пароль?
          </button>
        </div>
      </form>
      
      <div className="login-form-links">
        <div className="login-form-divider">
          <span>Или</span>
        </div>
        
        <div className="login-form-options">
          <p className="login-form-question">Нет аккаунта?</p>
          <button 
            className="login-form-register-button" 
            type="button"
            onClick={handleRegisterClick}
            disabled={isLoading}
          >
            <i className="fas fa-user-plus"></i> Зарегистрироваться
          </button>
        </div>
      </div>
      
      <div className="login-form-info">
        <p>
          <i className="fas fa-info-circle"></i> 
          Для доступа к системе требуется предварительная регистрация и подтверждение email.
        </p>
      </div>
    </div>
  );
};

LoginForm.displayName = 'LoginForm';

export default LoginForm;