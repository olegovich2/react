import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

interface HeaderProps {
  showAccountButton?: boolean;
  showExitButton?: boolean;
  showBackButton?: boolean;
  showSettingsButton?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  showAccountButton = false, 
  showExitButton = false,
  showBackButton = false,
  showSettingsButton = false
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleAccountClick = () => {
    navigate('/account');
  };

  const handleExitClick = () => {
    logout();
    navigate('/login');
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
        {/* Кнопка "Назад" */}
        {showBackButton && (
          <button 
            className="personal_account back-button" 
            type="button" 
            onClick={handleBackClick}
            title="Назад"
            aria-label="Назад"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
        )}
        
        {/* Кнопка "Настройки" */}
        {showSettingsButton && !location.pathname.includes('/account/settings') && (
          <button 
            className="personal_account settings-button" 
            type="button" 
            onClick={handleSettingsClick}
            title="Настройки"
            aria-label="Настройки аккаунта"
          >
            <i className="fa-solid fa-gear"></i>
          </button>
        )}
        
        {/* Кнопка аккаунта */}
        {showAccountButton && (
          <button 
            className="personal_account" 
            type="button" 
            data-button="toAccount"
            onClick={handleAccountClick}
            title="Личный кабинет"
            aria-label="Личный кабинет"
          >
            <i className="fa-solid fa-receipt"></i>
          </button>
        )}
        
        {/* Кнопка выхода */}
        {showExitButton && (
          <button 
            className="exit_button" 
            type="button" 
            data-button="toEntry"
            onClick={handleExitClick}
            title="Выход"
            aria-label="Выход из системы"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;