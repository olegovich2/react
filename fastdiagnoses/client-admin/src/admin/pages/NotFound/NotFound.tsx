import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFound.css';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
console.log('render NotFound');
  return (
    <div className="admin-not-found">
      <div className="admin-not-found-content">
        <div className="admin-not-found-icon">404</div>
        <h1 className="admin-not-found-title">Страница не найдена</h1>
        <p className="admin-not-found-description">
          Запрошенная страница не существует или была перемещена.
        </p>
        <div className="admin-not-found-actions">
          <button 
            onClick={() => navigate('/admin')}
            className="admin-not-found-button-primary"
          >
            На главную
          </button>
          <button 
            onClick={() => navigate(-1)}
            className="admin-not-found-button-secondary"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  );
};

NotFound.displayName = 'NotFound';
export default NotFound;