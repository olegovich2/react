import React from 'react';
import './Loader.css';

const Loader: React.FC = () => {
  console.log('render Loader');
  return (
    <div className="admin-loader">
      <div className="admin-loader-content">
        <div className="admin-loader-spinner"></div>
        <p className="admin-loader-text">Загрузка...</p>
      </div>
    </div>
  );
};

Loader.displayName = 'Loader';
export default Loader;