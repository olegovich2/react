import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

interface HeaderProps {
  // Убираем все пропсы, так как логика будет на основе location
}

const Header: React.FC<HeaderProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  // Определяем текущую страницу
  const isLoginPage = location.pathname === '/login' || location.pathname === '/auth' || location.pathname === '/register';
  const isAccountPage = location.pathname === '/account';
  const isSettingsPage = location.pathname.includes('/account/settings');
  const isHomePage = location.pathname === '/' || location.pathname === '/main';

  const handleAccountClick = () => {
    navigate('/account');
  };

  const handleExitClick = async() => {
    try {
    // Ждем завершения logout
    await logout();
  } catch (error) {
    // Даже если ошибка, все равно редиректим
    console.error('Ошибка при выходе:', error);
  } finally {
    // Всегда редиректим на логин
    navigate('/login');
  }
  };

  const handleBackClick = () => {
    // Если мы на странице настроек, возвращаемся в аккаунт
    if (location.pathname.includes('/account/settings')) {
      navigate('/account');
    } else {
      navigate(-1);
    }
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleSettingsClick = () => {
    navigate('/account/settings');
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  // Рендерим кнопки в зависимости от страницы
  const renderButtons = () => {
    // Страница авторизации/аутентификации - БЕЗ кнопок
    if (isLoginPage) {
      return null;
    }

    // Страница настроек - БЕЗ кнопок
    if (isSettingsPage) {
      return null;
    }

    // Главная страница - кнопки "В аккаунт" и "Выход"
    if (isHomePage) {
      return (
        <>
          <button 
            className="personal_account" 
            type="button" 
            onClick={handleAccountClick}
            title="В аккаунт"
            aria-label="Перейти в личный кабинет"
          >
            <i className="fa-solid fa-receipt"></i>
            <span className="button-text">В аккаунт</span>
          </button>
          
          <button 
            className="exit_button" 
            type="button" 
            onClick={handleExitClick}
            title="Выход"
            aria-label="Выход из системы"
          >
            <i className="fa-solid fa-xmark"></i>
            <span className="button-text">Выход</span>
          </button>
        </>
      );
    }

    // Страница аккаунта - кнопки "На главную" и "Настройки"
    if (isAccountPage) {
      return (
        <>
          <button 
            className="personal_account home-button" 
            type="button" 
            onClick={handleHomeClick}
            title="На главную"
            aria-label="Перейти на главную страницу"
          >
            <i className="fa-solid fa-home"></i>
            <span className="button-text">На главную</span>
          </button>
          
          <button 
            className="personal_account settings-button" 
            type="button" 
            onClick={handleSettingsClick}
            title="Настройки"
            aria-label="Перейти к настройкам аккаунта"
          >
            <i className="fa-solid fa-gear"></i>
            <span className="button-text">Настройки</span>
          </button>
        </>
      );
    }

    // Для всех остальных страниц (если есть) - кнопка "Назад"
    return (
      <button 
        className="personal_account back-button" 
        type="button" 
        onClick={handleBackClick}
        title="Назад"
        aria-label="Вернуться назад"
      >
        <i className="fa-solid fa-arrow-left"></i>
        <span className="button-text">Назад</span>
      </button>
    );
  };

  return (
    <header className="header">
      <img 
        className="svg_param" 
        src="/images/icon.png" 
        alt="иконка" 
        title="иконка"
        onClick={handleLogoClick}
      />
      <h1>QUICK DIAGNOSIS</h1>
      
      <div className="buttonsLogin" data-container="buttons">
        {renderButtons()}
      </div>
    </header>
  );
};

Header.displayName='Header';

export default Header;