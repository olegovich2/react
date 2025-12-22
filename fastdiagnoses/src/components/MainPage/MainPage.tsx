import React, { useState, useEffect } from 'react';
import Header from '../Layout/Header';
import Footer from '../Layout/Footer';
import Navbar from '../Layout/Navbar';
import RespiratoryForm from './RespiratoryForm/RespiratoryForm';
import ResultSurvey from './ResultSurvey/ResultSurvey';
import { useNavigate } from 'react-router-dom';
import { Survey } from '../AccountPage/types/account.types';
import { fetchClient } from '../../api/fetchClient';
import './MainPage.css';

const MainPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('');
  const [showResult, setShowResult] = useState<boolean>(false);
  const [currentSurvey, setCurrentSurvey] = useState<Survey | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const result = await fetchClient.verifyToken();
        if (!result.success) {
          navigate('/login');
        }
      } catch (error) {
        console.error('Ошибка проверки токена:', error);
        navigate('/login');
      }
    };

    verifyToken();

    return () => {
      localStorage.removeItem('allSurveys');
      localStorage.removeItem('originImage');
    };
  }, [navigate]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(activeTab === tabId ? '' : tabId);
    if (showResult) {
      setShowResult(false);
    }
  };

  const handleSurveySubmit = (survey: Survey) => {
    setCurrentSurvey(survey);
    setShowResult(true);
    setActiveTab('');
    localStorage.setItem('survey', JSON.stringify(survey));
  };

  const handleCloseResult = () => {
    setShowResult(false);
    setCurrentSurvey(null);
    localStorage.removeItem('survey');
  };

  const handleSaveToAccount = async () => {
    alert('Функция сохранения опроса в аккаунт находится в разработке');
  };

  return (
    <div className="main-page-container">
      <Header />
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <main className="main-content">
        {/* Общие формы (в разработке) */}
        <div className={`forms-content-container ${activeTab !== 'general' ? '' : 'active'}`}>
          {activeTab === 'general' && (
            <div className="respiratory-form">
              <form data-form="general">Опрос по всем системам в разработке</form>
            </div>
          )}
        </div>

        {/* Форма дыхательной системы */}
        <div className={`respiratory-form-container ${activeTab === 'respiratory' ? 'active' : ''}`}>
          {activeTab === 'respiratory' && (
            <RespiratoryForm onSubmit={handleSurveySubmit} />
          )}
        </div>

        {/* Остальные формы (в разработке) */}
        <div className={`forms-content-container ${activeTab !== 'cardiovascular' ? '' : 'active'}`}>
          {activeTab === 'cardiovascular' && (
            <div className="respiratory-form">
              <form data-form="cardiovascular">Форма сердечно-сосудистой системы в разработке</form>
            </div>
          )}
        </div>
        
        <div className={`forms-content-container ${activeTab !== 'digestive' ? '' : 'active'}`}>
          {activeTab === 'digestive' && (
            <div className="respiratory-form">
              <form data-form="digestive">Форма пищеварительной системы в разработке</form>
            </div>
          )}
        </div>
        
        <div className={`forms-content-container ${activeTab !== 'urinary' ? '' : 'active'}`}>
          {activeTab === 'urinary' && (
            <div className="respiratory-form">
              <form data-form="urinary">Форма мочеиспускательной системы в разработке</form>
            </div>
          )}
        </div>
        
        <div className={`forms-content-container ${activeTab !== 'musculoskeletal' ? '' : 'active'}`}>
          {activeTab === 'musculoskeletal' && (
            <div className="respiratory-form">
              <form data-form="musculoskeletal">Форма опорно-двигательной системы в разработке</form>
            </div>
          )}
        </div>

        {/* Результат опроса */}
        <div className={`result-survey-container ${showResult && currentSurvey ? 'active' : ''}`}>
          {showResult && currentSurvey && (
            <ResultSurvey 
              survey={currentSurvey} 
              onClose={handleCloseResult}
              onSaveToAccount={handleSaveToAccount}
            />
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default MainPage;