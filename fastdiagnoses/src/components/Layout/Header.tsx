import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  showAccountButton?: boolean;
  showExitButton?: boolean;
  showBackButton?: boolean; // ← Добавляем это свойство
}

const Header: React.FC<HeaderProps> = ({ 
  showAccountButton = false, 
  showExitButton = false,
  showBackButton = false 
}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleAccountClick = () => {
    navigate('/account');
  };

  const handleExitClick = () => {
    logout();
    navigate('/login');
  };

  const handleBackClick = () => {
    navigate(-1); // Возврат на предыдущую страницу
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <header className="header">
      <img 
        className="svg_param" 
        src="/images/icon.png" 
        alt="иконка" 
        title="иконка"
        onClick={handleLogoClick}
        style={{ cursor: 'pointer' }}
      />
      <h1>QUICK DIAGNOSIS</h1>
      
      <div className="buttonsLogin" data-container="buttons">
        {/* Кнопка "Назад" */}
        {showBackButton && (
          <button 
            className="personal_account" 
            type="button" 
            onClick={handleBackClick}
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
        )}
        
        {/* Кнопка аккаунта */}
        {showAccountButton && (
          <button 
            className="personal_account" 
            type="button" 
            data-button="toAccount"
            onClick={handleAccountClick}
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
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;