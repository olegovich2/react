import React from 'react';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import LoginForm from '../components/Auth/LoginForm';

const LoginPage: React.FC = () => {
  const handleLoginSuccess = () => {
    console.log('Вход выполнен успешно');
  };

  const handleLoginError = (message: string) => {
    console.error('Ошибка входа:', message);
  };

  return (
    <div className="main" data-main="mainElement">
      <Header showBackButton={false} />
      
      <main className="main">
        <LoginForm 
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          redirectOnSuccess={true}
        />
      </main>
      
      <Footer />
    </div>
  );
};

export default LoginPage;