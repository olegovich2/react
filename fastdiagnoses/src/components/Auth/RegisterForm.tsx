import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../../api/auth.api';
import { RegisterData } from '../../types/api.types';
import { validateEmail } from '../../utils/formatters';

interface RegisterFormProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onError
}) => {
  const [formData, setFormData] = useState<RegisterData>({
    login: '',
    password: '',
    confirmPassword: '',
    email: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Валидация логина
    if (!formData.login.trim()) {
      newErrors.login = 'Логин обязателен';
    } else if (formData.login.length < 3) {
      newErrors.login = 'Логин должен содержать минимум 3 символа';
    } else if (formData.login.includes('<') || formData.login.includes('>') || 
               formData.login.includes('/') || formData.login.includes('&')) {
      newErrors.login = 'Логин содержит запрещенные символы';
    }

    // Валидация пароля
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен содержать минимум 6 символов';
    } else if (formData.password.includes('<') || formData.password.includes('>') || 
               formData.password.includes(' ')) {
      newErrors.password = 'Пароль содержит запрещенные символы';
    }

    // Подтверждение пароля
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    // Валидация email
    if (!formData.email) {
      newErrors.email = 'Email обязателен';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Введите корректный email адрес';
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
    
    // Очищаем сообщение об успехе при изменении формы
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const result = await register({
        login: formData.login,
        password: formData.password,
        email: formData.email
      });

      if (result.success) {
        const message = result.message || 'Регистрация успешна! Проверьте email для подтверждения.';
        setSuccessMessage(message);
        
        // Очищаем форму
        setFormData({
          login: '',
          password: '',
          confirmPassword: '',
          email: ''
        });
        
        if (onSuccess) {
          onSuccess(message);
        }
        
        // Автоматический редирект на страницу входа через 5 секунд
        setTimeout(() => {
          navigate('/login');
        }, 5000);
      } else {
        setErrors({ submit: result.message || 'Ошибка регистрации' });
        
        if (onError) {
          onError(result.message || 'Ошибка регистрации');
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Произошла ошибка при регистрации';
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

  return (
    <div className="auth-form-container">
      <h3>Чтобы зарегистрироваться - заполните данные полей:</h3>
      
      {successMessage && (
        <div className="success">
          <p className="success_p">{successMessage}</p>
          <p className="success_p">Вы будете перенаправлены на страницу входа через 5 секунд...</p>
        </div>
      )}
      
      {errors.submit && (
        <div className="errors">
          <p className="errors_p">{errors.submit}</p>
        </div>
      )}
      
      <form 
        className="formForAuth" 
        onSubmit={handleSubmit} 
        data-form="auth"
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
            disabled={isLoading}
            autoComplete="new-password"
          />
          {errors.password && <span className="errors_p">{errors.password}</span>}
        </div>
        
        <div className="fields">
          <p>Подтвердите пароль:</p>
          <input 
            className={`input ${errors.confirmPassword ? 'errors' : ''}`}
            type="password"
            placeholder="Подтвердите пароль"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
            autoComplete="new-password"
          />
          {errors.confirmPassword && <span className="errors_p">{errors.confirmPassword}</span>}
        </div>
        
        <div className="fields">
          <p>Введите ваш email:</p>
          <input 
            className={`input ${errors.email ? 'errors' : ''}`}
            type="email"
            placeholder="Введите ваш email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
            autoComplete="email"
          />
          {errors.email && <span className="errors_p">{errors.email}</span>}
        </div>
        
        <button 
          className="buttonFromTemplate" 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Регистрация...' : 'Отправить'}
        </button>
      </form>
      
      <div className="auth-links">
        <p>Уже есть аккаунт?</p>
        <button 
          className="buttonFromTemplate" 
          type="button"
          onClick={handleLoginClick}
          disabled={isLoading}
        >
          Войти
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;