import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import { AccountProvider } from './context/AccountContext';
import SurveysContainer from './components/SurveysContainer/SurveysContainer';
import ImagesContainer from './components/ImagesContainer/ImagesContainer';
import './AccountPage.css';

const AccountPageContent: React.FC = () => {
  const navigate = useNavigate();

  // Проверка авторизации
  React.useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    
    if (!user.login || !token) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="general" data-main="mainElement">
      <Header showBackButton={true} />

      <main className="general">
        <div className="mainAccount">
          {/* 1. Список опросов (на всю ширину) */}
          <div className="full-width-section">
            <SurveysContainer />
          </div>
          
          {/* 2. Блок загрузки и отображения изображений (на всю ширину) */}
          <div className="full-width-section">
            <ImagesContainer />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

const AccountPage: React.FC = () => {
  return (
    <AccountProvider>
      <AccountPageContent />
    </AccountProvider>
  );
};

export default AccountPage;