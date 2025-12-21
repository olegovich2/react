import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import { AccountProvider } from './context/AccountContext';
import { ScrollProvider } from './context/ScrollContext'; 
import SurveysContainerPaginated from './components/SurveysContainer/SurveysContainer.paginated';
import ImagesContainerPaginated from './components/ImagesContainer/ImagesContainer.paginated';

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
      <Header showBackButton={true} showSettingsButton={true}/>

      <main className="general">
        <div className="mainAccount">
          {/* 1. Список опросов с пагинацией */}
          <div className="full-width-section">
            <SurveysContainerPaginated />
          </div>
          
          {/* 2. Блок загрузки и отображения изображений */}
          <div className="full-width-section">
            <ImagesContainerPaginated />
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
      <ScrollProvider> 
        <AccountPageContent />
      </ScrollProvider>
    </AccountProvider>
  );
};

export default AccountPage;