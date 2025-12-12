import React, { useState, useEffect } from 'react';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import Navbar from '../components/Layout/Navbar';
import RespiratoryForm from '../components/Main/RespiratoryForm';
import ResultSurvey from '../components/Main/ResultSurvey';
import { checkJWT } from '../api/auth.api';
import { useNavigate } from 'react-router-dom';
import { Survey } from '../types/api.types';

const MainPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('');
  const [showResult, setShowResult] = useState<boolean>(false);
  const [currentSurvey, setCurrentSurvey] = useState<Survey | null>(null);
  const navigate = useNavigate();

  // Проверка JWT при загрузке (как в logicTab.js)
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const result = await checkJWT();
      if (!result.success) {
        navigate('/login');
      }
    };

    verifyToken();

    // Очистка localStorage (как в dataFromFormEntry.js)
    const cleanup = () => {
      localStorage.removeItem('allSurveys');
      localStorage.removeItem('originImage');
    };

    return cleanup;
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

  // Добавленная функция для сохранения опроса в аккаунт
  const handleSaveToAccount = async () => {
    try {
      if (!currentSurvey) {
        console.error('Нет данных опроса для сохранения');
        return;
      }

      // Здесь будет логика сохранения опроса в аккаунт пользователя
      // Например, вызов API для сохранения
      console.log('Сохранение опроса в аккаунт:', currentSurvey);
      
      // Пример API вызова:
      // const response = await saveSurveyToAccount(currentSurvey);
      // if (response.success) {
      //   alert('Опрос успешно сохранен в вашем аккаунте!');
      //   handleCloseResult();
      // } else {
      //   alert('Ошибка при сохранении опроса: ' + response.message);
      // }

      // Временно просто показываем сообщение
      alert('Функция сохранения опроса в аккаунт находится в разработке');
      
    } catch (error) {
      console.error('Ошибка при сохранении опроса:', error);
      alert('Произошла ошибка при сохранении опроса');
    }
  };

  return (
    <div>
      <Header 
        showAccountButton={true} 
        showExitButton={true} 
        showBackButton={false} 
      />
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <main className="main" data-main="mainElement">
        {/* Общие формы (в разработке) */}
        <section className={`forms_content ${activeTab !== 'general' ? 'unvisible' : ''}`} id="general">
          <form data-form="general">Опрос по всем системам в разработке</form>
        </section>

        {/* Форма дыхательной системы */}
        {activeTab === 'respiratory' && (
          <RespiratoryForm onSubmit={handleSurveySubmit} />
        )}

        {/* Остальные формы (в разработке) */}
        <section className={`forms_content ${activeTab !== 'cardiovascular' ? 'unvisible' : ''}`} id="cardiovascular">
          <form data-form="cardiovascular">Форма сердечно-сосудистой системы в разработке</form>
        </section>
        
        <section className={`forms_content ${activeTab !== 'digestive' ? 'unvisible' : ''}`} id="digestive">
          <form data-form="digestive">Форма пищеварительной системы в разработке</form>
        </section>
        
        <section className={`forms_content ${activeTab !== 'urinary' ? 'unvisible' : ''}`} id="urinary">
          <form data-form="urinary">Форма мочеиспускательной системы в разработке</form>
        </section>
        
        <section className={`forms_content ${activeTab !== 'musculoskeletal' ? 'unvisible' : ''}`} id="musculoskeletal">
          <form data-form="musculoskeletal">Форма опорно-двигательной системы в разработке</form>
        </section>

        {/* Результат опроса */}
        {showResult && currentSurvey && (
          <ResultSurvey 
            survey={currentSurvey} 
            onClose={handleCloseResult}
            onSaveToAccount={handleSaveToAccount}
          />
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default MainPage;