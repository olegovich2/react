import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsAPI } from '../../../../api/settings.api';
import Header from '../../../Layout/Header';
import Footer from '../../../Layout/Footer';
import './SettingsPage.css';

interface AccountData {
  login: string;
  email: string;
}

interface EmailChangeFormData {
  currentEmail: string;
  newEmail: string;
  reason: string;
}

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  // Смена пароля
  const [newPassword, setNewPassword] = useState({
    currentPassword: '',
    newPassword: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Смена email
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailFormData, setEmailFormData] = useState<EmailChangeFormData>({
    currentEmail: '',
    newEmail: '',
    reason: ''
  });
  const [emailFormError, setEmailFormError] = useState<string | null>(null);
  const [emailFormSuccess, setEmailFormSuccess] = useState<string | null>(null);
  const [emailFormLoading, setEmailFormLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      const response = await settingsAPI.getUserInfo();
      
      if (response.success && response.data?.user) {
        setAccountData(response.data.user);
        
        try {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        } catch (storageError) {
          console.warn('Не удалось сохранить данные пользователя:', storageError);
        }
      } else {
        setError('Не удалось загрузить данные пользователя');
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError('Ошибка при загрузке данных пользователя');
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (): boolean => {
    setPasswordError(null);

    if (!newPassword.currentPassword) {
      setPasswordError('Введите текущий пароль');
      return false;
    }

    if (!newPassword.newPassword) {
      setPasswordError('Введите новый пароль');
      return false;
    }

    if (!confirmPassword) {
      setPasswordError('Подтвердите новый пароль');
      return false;
    }

    if (newPassword.newPassword !== confirmPassword) {
      setPasswordError('Новые пароли не совпадают');
      return false;
    }

    if (newPassword.newPassword.length < 6) {
      setPasswordError('Пароль должен быть не менее 6 символов');
      return false;
    }

    const hasUpperCase = /[A-Z]/.test(newPassword.newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword.newPassword);
    const hasNumbers = /\d/.test(newPassword.newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      setPasswordError('Пароль должен содержать заглавные, строчные буквы и цифры');
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) {
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError(null);

      const response = await settingsAPI.changePassword({
        currentPassword: newPassword.currentPassword,
        newPassword: newPassword.newPassword
      });
      
      if (response.success) {
        const emailMessage = response.data?.emailSent 
          ? "📧 На вашу электронную почту отправлено уведомление об изменении пароля.\n\n" +
            "🔐 В целях безопасности пароль в письме НЕ указан."
          : "";
        
        alert(
          "✅ Пароль успешно изменен!\n\n" +
          emailMessage +
          "\n" +
          "📋 Далее нужно:\n" +
          "1. Вас перенаправит на страницу входа\n" +
          "2. Введите НОВЫЙ пароль\n" +
          "3. Сохраните его в менеджере паролей\n\n" +
          "Нажмите OK для продолжения."
        );
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        
        navigate(`/login?passwordChanged=true&emailSent=${response.data?.emailSent || false}`);
        
      } else {
        setPasswordError(response.message || 'Ошибка при смене пароля');
      }
    } catch (error) {
      console.error('Ошибка при смене пароля:', error);
      setPasswordError('Произошла ошибка при смене пароля');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    const confirmDelete = window.confirm(
      'ВНИМАНИЕ: Это действие нельзя отменить!\n\n' +
      'Все ваши данные будут удалены:\n' +
      '• Все сохраненные опросы\n' +
      '• Все загруженные изображения\n' +
      '• История активности\n\n' +
      'Вы уверены, что хотите удалить аккаунт?'
    );

    if (!confirmDelete) {
      setDeleteConfirm(false);
      return;
    }

    try {
      setDeleteLoading(true);
      const response = await settingsAPI.deleteAccount();
      
      if (response.success) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        
        alert('Аккаунт успешно удален');
        
        navigate('/login');
        window.location.reload();
      } else {
        setError(response.message || 'Ошибка при удалении аккаунта');
        setDeleteConfirm(false);
      }
    } catch (error) {
      console.error('Ошибка при удалении аккаунта:', error);
      setError('Произошла ошибка при удалении аккаунта');
      setDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const validateEmailForm = (): boolean => {
    setEmailFormError(null);

    if (!emailFormData.currentEmail) {
      setEmailFormError('Введите текущий email');
      return false;
    }

    if (!emailFormData.newEmail) {
      setEmailFormError('Введите новый email');
      return false;
    }

    if (!emailFormData.reason) {
      setEmailFormError('Укажите причину смены email');
      return false;
    }

    if (emailFormData.currentEmail === emailFormData.newEmail) {
      setEmailFormError('Новый email должен отличаться от текущего');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailFormData.currentEmail)) {
      setEmailFormError('Текущий email имеет неверный формат');
      return false;
    }

    if (!emailRegex.test(emailFormData.newEmail)) {
      setEmailFormError('Новый email имеет неверный формат');
      return false;
    }

    if (accountData && emailFormData.currentEmail !== accountData.email) {
      setEmailFormError('Текущий email не совпадает с email в системе');
      return false;
    }

    return true;
  };

  const handleEmailChangeRequest = async () => {
    if (!validateEmailForm()) {
      return;
    }

    try {
      setEmailFormLoading(true);
      setEmailFormError(null);
      setEmailFormSuccess(null);

      const response = await settingsAPI.requestEmailChange(emailFormData);
      
      if (response.success) {
        setEmailFormSuccess(
          '✅ Запрос отправлен администратору! ' + 
          (response.data?.notification || 'Вы получите уведомление после обработки.')
        );
        
        // Очищаем форму через 3 секунды
        setTimeout(() => {
          setShowEmailForm(false);
          setEmailFormData({
            currentEmail: '',
            newEmail: '',
            reason: ''
          });
          setEmailFormSuccess(null);
        }, 3000);
        
      } else {
        setEmailFormError(response.message || 'Ошибка отправки запроса');
      }
    } catch (error: any) {
      console.error('Ошибка отправки запроса:', error);
      setEmailFormError(error.response?.data?.message || 'Произошла ошибка при отправке запроса');
    } finally {
      setEmailFormLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/account');
  };

  if (loading) {
    return (
      <div className="general">
        <Header showBackButton={true} />
        <main className="settings-main">
          <div className="settings-container">
            <div className="settings-loading">
              <div className="spinner"></div>
              <p>Загрузка данных...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="general">
      <Header showBackButton={true} />
      
      <main className="settings-main">
        <div className="settings-container">
          <div className="settings-header">
            <button 
              className="settings-back-button" 
              onClick={handleBack}
              aria-label="Вернуться назад"
            >
              ← Назад
            </button>
            <h1 className="settings-title">Настройки аккаунта</h1>
          </div>

          {error && (
            <div className="settings-error">
              <p>{error}</p>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          <div className="settings-sections">
            {/* Секция 1: Информация об аккаунте */}
            <section className="settings-section">
              <h2 className="section-title">Информация об аккаунте</h2>
              
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Логин:</span>
                  <span className="info-value">{accountData?.login}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{accountData?.email}</span>
                </div>
              </div>
            </section>

            {/* Секция 2: Смена email */}
            <section className="settings-section">
              <h2 className="section-title">Смена email</h2>
              
              {!showEmailForm ? (
                <div className="email-change-info">
                  <p className="email-change-description">
                    Для смены email необходимо обратиться к администратору.
                    Заполните форму ниже, и мы автоматически отправим запрос администратору.
                  </p>
                  <button 
                    className="email-change-init-button"
                    onClick={() => setShowEmailForm(true)}
                  >
                    📧 Запросить смену email
                  </button>
                </div>
              ) : (
                <div className="email-form">
                  {emailFormError && (
                    <div className="email-form-error">
                      {emailFormError}
                    </div>
                  )}
                  
                  {emailFormSuccess && (
                    <div className="email-form-success">
                      <div className="success-content">
                        <p>{emailFormSuccess}</p>
                      </div>
                      <button 
                        className="success-close-button"
                        onClick={() => {
                          setEmailFormSuccess(null);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  
                  <div className="form-group">
                    <label htmlFor="currentEmail">
                      Подтвердите текущий email:
                      <span className="form-hint"> (должен совпадать с {accountData?.email})</span>
                    </label>
                    <input
                      type="email"
                      id="currentEmail"
                      value={emailFormData.currentEmail}
                      onChange={(e) => setEmailFormData({...emailFormData, currentEmail: e.target.value})}
                      placeholder="Введите ваш текущий email"
                      disabled={emailFormLoading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="newEmail">Новый email:</label>
                    <input
                      type="email"
                      id="newEmail"
                      value={emailFormData.newEmail}
                      onChange={(e) => setEmailFormData({...emailFormData, newEmail: e.target.value})}
                      placeholder="Введите новый email"
                      disabled={emailFormLoading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="reason">Причина смены:</label>
                    <textarea
                      id="reason"
                      value={emailFormData.reason}
                      onChange={(e) => setEmailFormData({...emailFormData, reason: e.target.value})}
                      placeholder="Объясните, почему нужно сменить email"
                      rows={3}
                      disabled={emailFormLoading}
                    />
                  </div>
                  
                  <div className="email-form-buttons">
                    <button 
                      className="email-form-submit-button"
                      onClick={handleEmailChangeRequest}
                      disabled={emailFormLoading}
                    >
                      {emailFormLoading ? (
                        <>
                          <span className="button-spinner"></span>
                          Отправка...
                        </>
                      ) : (
                        '📨 Отправить запрос администратору'
                      )}
                    </button>
                    <button 
                      className="email-form-cancel-button"
                      onClick={() => {
                        setShowEmailForm(false);
                        setEmailFormError(null);
                        setEmailFormData({
                          currentEmail: '',
                          newEmail: '',
                          reason: ''
                        });
                        setEmailFormSuccess(null);
                      }}
                      disabled={emailFormLoading}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Секция 3: Безопасность */}
            <section className="settings-section">
              <h2 className="section-title">Безопасность</h2>
              
              <div className="password-form">
                {passwordError && (
                  <div className="password-error">
                    {passwordError}
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="currentPassword">Текущий пароль</label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={newPassword.currentPassword}
                    onChange={(e) => setNewPassword({...newPassword, currentPassword: e.target.value})}
                    placeholder="Введите текущий пароль"
                    disabled={passwordLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="newPassword">Новый пароль</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword.newPassword}
                    onChange={(e) => setNewPassword({...newPassword, newPassword: e.target.value})}
                    placeholder="Введите новый пароль (мин. 6 символов)"
                    disabled={passwordLoading}
                  />
                  <div className="password-hint">
                    Должен содержать заглавные, строчные буквы и цифры
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="confirmPassword">Подтвердите новый пароль</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повторите новый пароль"
                    disabled={passwordLoading}
                  />
                </div>
                
                <button 
                  className="change-password-button"
                  onClick={handleChangePassword}
                  disabled={passwordLoading || !newPassword.currentPassword || !newPassword.newPassword || !confirmPassword}
                >
                  {passwordLoading ? (
                    <>
                      <span className="button-spinner"></span>
                      Смена пароля...
                    </>
                  ) : (
                    'Сменить пароль'
                  )}
                </button>
              </div>
            </section>

            {/* Секция 4: Удаление аккаунта */}
            <section className="settings-section">
              <h2 className="section-title">Удаление аккаунта</h2>
              
              <div className="delete-section">
                <p className="delete-warning">
                  ⚠️ Внимание! Это действие нельзя отменить. Все ваши данные будут безвозвратно удалены.
                </p>
                
                {deleteConfirm ? (
                  <div className="delete-confirm">
                    <p className="delete-confirm-text">
                      Вы уверены, что хотите удалить аккаунт? Все данные будут удалены:
                    </p>
                    <ul className="delete-list">
                      <li>Все сохраненные опросы</li>
                      <li>Все загруженные изображения</li>
                      <li>История активности</li>
                      <li>Настройки аккаунта</li>
                    </ul>
                    <div className="delete-buttons">
                      <button 
                        className="delete-confirm-button"
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? (
                          <>
                            <span className="button-spinner"></span>
                            Удаление...
                          </>
                        ) : (
                          'Да, удалить аккаунт'
                        )}
                      </button>
                      <button 
                        className="delete-cancel-button"
                        onClick={() => {
                          setDeleteConfirm(false);
                          setError(null);
                        }}
                        disabled={deleteLoading}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="delete-button"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    🗑️ Удалить аккаунт
                  </button>
                )}
              </div>
            </section>

            {/* Секция 5: Информация о системе */}
            <section className="settings-section">
              <h2 className="section-title">О системе</h2>
              
              <div className="system-info">
                <div className="system-info-item">
                  <strong>Название:</strong> QuickDiagnosis
                </div>
                <div className="system-info-item">
                  <strong>Версия:</strong> 2.0.0
                </div>
                <div className="system-info-item">
                  <strong>Тип лицензии:</strong> Бесплатная
                </div>
                <div className="system-info-item">
                  <strong>Поддержка:</strong> support@quickdiagnosis.com
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SettingsPage;