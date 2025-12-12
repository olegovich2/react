import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/auth.api';
import { LoginCredentials } from '../../types/api.types';

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
      const result = await login(formData);

      if (result.success && result.data) {
        // Успешный вход
        if (onSuccess) {
          onSuccess();
        }
        
        if (redirectOnSuccess) {
          // Редирект уже происходит в auth.api.ts
          console.log('Вход успешен, выполняется редирект...');
        }
      } else {
        // Ошибка входа (но не редирект)
        if (!result.redirected) {
          const errorMessage = result.message || 'Ошибка входа';
          setErrors({ submit: errorMessage });
          
          if (onError) {
            onError(errorMessage);
          }
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

  return (
    <div className="auth-form-container">
      <h3>Чтобы войти - заполните данные полей:</h3>
      
      {errors.submit && (
        <div className="errors">
          <p className="errors_p">{errors.submit}</p>
        </div>
      )}
      
      <form 
        className="formforEntry" 
        onSubmit={handleSubmit} 
        data-form="entry"
      >
        <div className="fields">
          <p>Введите ваш логин:</p>
          <input 
            className={`input ${errors.login ? 'errors' : ''}`}
            type="text"
            placeholder="Введите ваш логин"
            name="login"
            value={formData.login}
            onChange={handleChange}
            data-input="login"
            disabled={isLoading}
            autoComplete="username"
          />
          {errors.login && <span className="errors_p">{errors.login}</span>}
        </div>
        
        <div className="fields">
          <p>Введите ваш пароль:</p>
          <input 
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
          {errors.password && <span className="errors_p">{errors.password}</span>}
        </div>
        
        <button 
          className="buttonFromTemplate" 
          type="submit"
          data-button="entry"
          disabled={isLoading}
        >
          {isLoading ? 'Вход...' : 'Войти'}
        </button>
      </form>
      
      <div className="auth-links">
        <p>Нет аккаунта?</p>
        <button 
          className="buttonFromTemplate" 
          type="button"
          onClick={handleRegisterClick}
          disabled={isLoading}
        >
          Зарегистрироваться
        </button>
      </div>
    </div>
  );
};

export default LoginForm;