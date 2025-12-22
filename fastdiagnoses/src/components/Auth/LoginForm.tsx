import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoginCredentials } from '../../types/api.types';
import './LoginForm.css'; // Импортируем стили

interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  redirectOnSuccess?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  redirectOnSuccess = true
}) => {
  const [formData, setFormData] = useState<LoginCredentials>({
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
    setFormData((prev: LoginCredentials) => ({
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
    <div className="auth-form-container">
      <div className="auth-header">
        <h3>Вход в систему</h3>
        <p className="auth-subtitle">Для входа введите ваш логин и пароль</p>
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
        data-form="entry"
        noValidate
      >
        <div className="fields">
          <label htmlFor="login">
            <i className="fas fa-user"></i> Логин:
          </label>
          <div className="input-wrapper">
            <input 
              id="login"
              className={`input ${errors.login ? 'errors' : ''}`}
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
              <span className="input-error">
                <i className="fas fa-exclamation-triangle"></i> {errors.login}
              </span>
            )}
          </div>
        </div>
        
        <div className="fields">
          <label htmlFor="password">
            <i className="fas fa-lock"></i> Пароль:
          </label>
          <div className="input-wrapper">
            <input 
              id="password"
              className={`input ${errors.password ? 'errors' : ''}`}
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
              <span className="input-error">
                <i className="fas fa-exclamation-triangle"></i> {errors.password}
              </span>
            )}
          </div>
        </div>
        
        <div className="form-actions">
          <button 
            className="buttonFromTemplate" 
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
            className="buttonFromTemplateTwo" 
            type="button"
            onClick={handleForgotPassword}
            disabled={isLoading}
          >
            <i className="fas fa-question-circle"></i> Забыли пароль?
          </button>
        </div>
      </form>
      
      <div className="auth-links">
        <div className="auth-divider">
          <span>Или</span>
        </div>
        
        <div className="auth-options">
          <p className="auth-question">Нет аккаунта?</p>
          <button 
            className="upload-button" 
            type="button"
            onClick={handleRegisterClick}
            disabled={isLoading}
          >
            <i className="fas fa-user-plus"></i> Зарегистрироваться
          </button>
        </div>
      </div>
      
      <div className="auth-info">
        <p>
          <i className="fas fa-info-circle"></i> 
          Для доступа к системе требуется предварительная регистрация и подтверждение email.
        </p>
      </div>
    </div>
  );
};

export default LoginForm;