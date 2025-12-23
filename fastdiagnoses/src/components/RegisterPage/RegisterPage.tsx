import React from 'react';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import RegisterForm from './RegisterForm/RegisterForm';
import './RegisterPage.css'; 

const RegisterPage: React.FC = () => {
  const handleRegisterSuccess = () => {
    console.log('Регистрация успешна');
  };

  const handleRegisterError = (message: string) => {
    console.error('Ошибка регистрации:', message);
  };

  return (
    <div className="reg-page-container">
      <Header/>
      
      <main className="reg-page-main-content">
        <div className="reg-page-form-container">
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

RegisterPage.displayName = 'RegisterPage';

export default RegisterPage;