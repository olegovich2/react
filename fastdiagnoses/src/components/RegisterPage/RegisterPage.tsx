import React from 'react';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import RegisterForm from './RegisterForm/RegisterForm';
import './RegisterPage.css'; // Импортируем стили страницы

const RegisterPage: React.FC = () => {
  const handleRegisterSuccess = () => {
    console.log('Регистрация успешна');
  };

  const handleRegisterError = (message: string) => {
    console.error('Ошибка регистрации:', message);
  };

  return (
    <div className="register-page-container">
      <Header/>
      
      <main className="register-main-content">
        <div className="register-form-container">
          <RegisterForm 
            onSuccess={handleRegisterSuccess}
            onError={handleRegisterError}
          />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default RegisterPage;