import React from 'react';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import RegisterForm from '../components/Auth/RegisterForm';

const RegisterPage: React.FC = () => {
  const handleRegisterSuccess = () => {
    console.log('Регистрация успешна');
  };

  const handleRegisterError = (message: string) => {
    console.error('Ошибка регистрации:', message);
  };

  return (
    <div className="main" data-main="mainElement">
      <Header showBackButton={false} />
      
      <main className="main">
        <RegisterForm 
          onSuccess={handleRegisterSuccess}
          onError={handleRegisterError}
        />
      </main>
      
      <Footer />
    </div>
  );
};

export default RegisterPage;