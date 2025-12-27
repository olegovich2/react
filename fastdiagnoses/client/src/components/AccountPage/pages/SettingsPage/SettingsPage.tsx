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

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  
  // Смена пароля
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    secretWord: '' // Новое поле: кодовое слово
  });
  
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Состояния для показа/скрытия паролей
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });

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

  const validatePasswordForm = (): boolean => {
    setPasswordError(null);
    const lettersOnlyRegex = /^[а-яёА-ЯЁa-zA-Z]+$/;

    if (!passwordForm.currentPassword) {
      setPasswordError('Введите текущий пароль');
      return false;
    }

    if (!passwordForm.newPassword) {
      setPasswordError('Введите новый пароль');
      return false;
    }

    if (!passwordForm.confirmPassword) {
      setPasswordError('Подтвердите новый пароль');
      return false;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Новые пароли не совпадают');
      return false;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Пароль должен быть не менее 6 символов');
      return false;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(passwordForm.newPassword)) {
      setPasswordError('Пароль должен содержать заглавные, строчные буквы и цифры');
      return false;
    }

    // Валидация кодового слова
    if (!passwordForm.secretWord.trim()) {
      setPasswordError('Кодовое слово обязательно');
      return false;
    } else if (passwordForm.secretWord.length < 3) {
      setPasswordError('Кодовое слово должно быть минимум 3 символа');
      return false;
    } else if (passwordForm.secretWord.length > 50) {
      setPasswordError('Кодовое слово должно быть максимум 50 символов');
      return false;
    } else if (!lettersOnlyRegex.test(passwordForm.secretWord)) {
      setPasswordError('Только буквы (русские или английские), без цифр и спецсимволов');
      return false;
    } else if (/<[^>]*>|javascript:|on\w+\s*=/.test(passwordForm.secretWord.toLowerCase())) {
      setPasswordError('Недопустимые символы в кодовом слове');
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) {
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError(null);
      setPasswordSuccess(null);

      const response = await settingsAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        secretWord: passwordForm.secretWord
      });
      
      if (response.success) {
        const emailMessage = response.data?.emailSent 
          ? "📧 На вашу электронную почту отправлено уведомление об изменении пароля.\n\n" +
            "🔐 В целях безопасности пароль в письме НЕ указан."
          : "";
        
        setPasswordSuccess(
          "✅ Пароль успешно изменен!\n\n" +
          emailMessage +
          "\n" +
          "📋 Далее нужно:\n" +
          "1. Вас перенаправит на страницу входа\n" +
          "2. Введите НОВЫЙ пароль\n" +
          "3. Сохраните его в менеджере паролей\n\n" +
          "Нажмите OK для продолжения."
        );
        
        // Очищаем форму
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
          secretWord: ''
        });
        
        // Перенаправление через 5 секунд
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.clear();
          
          navigate(`/login?passwordChanged=true&emailSent=${response.data?.emailSent || false}`);
        }, 5000);
        
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

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSupportClick = () => {
    navigate('/support');
  };

  const handleBack = () => {
    navigate('/account');
  };

  if (loading) {
    return (
      <div className="set-page-general">
        <Header />
        <main className="set-page-main">
          <div className="set-page-container">
            <div className="set-page-loading">
              <div className="set-page-spinner"></div>
              <p>Загрузка данных...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="set-page-general">
      <Header/>
      
      <main className="set-page-main">
        <div className="set-page-container">
          <div className="set-page-header">
            <button 
              className="set-page-back-button" 
              onClick={handleBack}
              aria-label="Вернуться назад"
            >
              ← Назад
            </button>
            <h1 className="set-page-title">Настройки аккаунта</h1>
          </div>

          {error && (
            <div className="set-page-error">
              <p>{error}</p>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          <div className="set-page-sections">
            {/* Секция 1: Информация об аккаунте */}
            <section className="set-page-section">
              <h2 className="set-page-section-title">Информация об аккаунте</h2>
              
              <div className="set-page-info-grid">
                <div className="set-page-info-item">
                  <span className="set-page-info-label">Логин:</span>
                  <span className="set-page-info-value">{accountData?.login}</span>
                </div>
                
                <div className="set-page-info-item">
                  <span className="set-page-info-label">Email:</span>
                  <span className="set-page-info-value">{accountData?.email}</span>
                </div>
              </div>
            </section>

            {/* Секция 2: Ссылка на техподдержку вместо смены email */}
            <section className="set-page-section">
              <h2 className="set-page-section-title">Нужна помощь?</h2>
              
              <div className="set-page-support-info">
                <p className="set-page-support-description">
                  Если вы не нашли нужного функционала, возникли технические проблемы 
                  или у вас есть вопросы по работе системы, обратитесь в нашу службу поддержки.
                </p>
                
                <div className="set-page-support-features">
                  <p><strong>Чем может помочь поддержка:</strong></p>
                  <ul className="set-page-support-list">
                    <li>Восстановление доступа к аккаунту</li>
                    <li>Решение технических проблем</li>
                    <li>Обработка запросов на смену email</li>
                    <li>Обработка запросов на смену пароля</li>
                    <li>Обработка запросов на для удаления аккаунта</li>
                  </ul>
                </div>
                
                <div className="set-page-support-link-container">
                  <button 
                    type="button" 
                    className="set-page-support-link"
                    onClick={handleSupportClick}
                  >
                    <i className="fas fa-headset"></i> Перейти в техническую поддержку
                  </button>
                </div>
              </div>
            </section>

            {/* Секция 3: Смена пароля с кодовым словом */}
            <section className="set-page-section">
              <h2 className="set-page-section-title">Смена пароля</h2>
              
              <div className="set-page-password-form">
                {passwordError && (
                  <div className="set-page-password-error">
                    <i className="fas fa-exclamation-triangle"></i> {passwordError}
                  </div>
                )}
                
                {passwordSuccess && (
                  <div className="set-page-password-success">
                    <div className="set-page-password-success-content">
                      <p style={{ whiteSpace: 'pre-line' }}>{passwordSuccess}</p>
                      <div className="set-page-redirect-timer">
                        <p>Автоматический переход через 5 секунд...</p>
                      </div>
                    </div>
                    <button 
                      className="set-page-success-close-button"
                      onClick={() => setPasswordSuccess(null)}
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                <div className="set-page-form-group">
                  <label htmlFor="set-current-password">
                    <i className="fas fa-lock"></i> Текущий пароль
                  </label>
                  <div className="set-page-password-container">
                    <input
                      id="set-current-password"
                      type={showPasswords.currentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      placeholder="Введите текущий пароль"
                      disabled={passwordLoading}
                      autoComplete="current-password"
                    />
                    <button 
                      type="button"
                      className="set-page-show-password"
                      onClick={() => togglePasswordVisibility('currentPassword')}
                      title={showPasswords.currentPassword ? "Скрыть пароль" : "Показать пароль"}
                      disabled={passwordLoading}
                    >
                      {showPasswords.currentPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                
                <div className="set-page-form-group">
                  <label htmlFor="set-new-password">
                    <i className="fas fa-key"></i> Новый пароль
                  </label>
                  <div className="set-page-password-container">
                    <input
                      id="set-new-password"
                      type={showPasswords.newPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      placeholder="Введите новый пароль (мин. 6 символов)"
                      disabled={passwordLoading}
                      autoComplete="new-password"
                    />
                    <button 
                      type="button"
                      className="set-page-show-password"
                      onClick={() => togglePasswordVisibility('newPassword')}
                      title={showPasswords.newPassword ? "Скрыть пароль" : "Показать пароль"}
                      disabled={passwordLoading}
                    >
                      {showPasswords.newPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                  <div className="set-page-password-hint">
                    Должен содержать заглавные, строчные буквы и цифры
                  </div>
                </div>
                
                <div className="set-page-form-group">
                  <label htmlFor="set-confirm-password">
                    <i className="fas fa-key"></i> Подтвердите новый пароль
                  </label>
                  <div className="set-page-password-container">
                    <input
                      id="set-confirm-password"
                      type={showPasswords.confirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      placeholder="Повторите новый пароль"
                      disabled={passwordLoading}
                      autoComplete="new-password"
                    />
                    <button 
                      type="button"
                      className="set-page-show-password"
                      onClick={() => togglePasswordVisibility('confirmPassword')}
                      title={showPasswords.confirmPassword ? "Скрыть пароль" : "Показать пароль"}
                      disabled={passwordLoading}
                    >
                      {showPasswords.confirmPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                  {passwordForm.newPassword && passwordForm.confirmPassword && 
                   passwordForm.newPassword === passwordForm.confirmPassword && (
                    <div className="set-page-password-match-success">
                      <i className="fas fa-check-circle"></i> Пароли совпадают
                    </div>
                  )}
                </div>
                
                <div className="set-page-form-group">
                  <label htmlFor="set-secret-word">
                    <i className="fas fa-shield-alt"></i> Кодовое слово
                  </label>
                  <input
                    id="set-secret-word"
                    type="text"
                    value={passwordForm.secretWord}
                    onChange={(e) => setPasswordForm({...passwordForm, secretWord: e.target.value})}
                    placeholder="Введите кодовое слово для подтверждения"
                    disabled={passwordLoading}
                    autoComplete="off"
                  />
                  <div className="set-page-secret-word-info">
                    <i className="fas fa-info-circle"></i>
                    <span>Введите кодовое слово, которое вы указывали при регистрации</span>
                  </div>
                </div>
                
                <button 
                  className="set-page-change-password-button"
                  onClick={handleChangePassword}
                  disabled={passwordLoading || 
                    !passwordForm.currentPassword || 
                    !passwordForm.newPassword || 
                    !passwordForm.confirmPassword || 
                    !passwordForm.secretWord
                  }
                >
                  {passwordLoading ? (
                    <>
                      <span className="set-page-button-spinner"></span>
                      Смена пароля...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-key"></i> Сменить пароль
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Секция 4: Удаление аккаунта */}
            <section className="set-page-section">
              <h2 className="set-page-section-title">Удаление аккаунта</h2>
              
              <div className="set-page-delete-section">
                <p className="set-page-delete-warning">
                  ⚠️ Внимание! Это действие нельзя отменить. Все ваши данные будут безвозвратно удалены.
                </p>
                
                {deleteConfirm ? (
                  <div className="set-page-delete-confirm">
                    <p className="set-page-delete-confirm-text">
                      Вы уверены, что хотите удалить аккаунт? Все данные будут удалены:
                    </p>
                    <ul className="set-page-delete-list">
                      <li>Все сохраненные опросы</li>
                      <li>Все загруженные изображения</li>
                      <li>История активности</li>
                      <li>Настройки аккаунта</li>
                    </ul>
                    <div className="set-page-delete-buttons">
                      <button 
                        className="set-page-delete-confirm-button"
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? (
                          <>
                            <span className="set-page-button-spinner"></span>
                            Удаление...
                          </>
                        ) : (
                          'Да, удалить аккаунт'
                        )}
                      </button>
                      <button 
                        className="set-page-delete-cancel-button"
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
                    className="set-page-delete-button"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    🗑️ Удалить аккаунт
                  </button>
                )}
              </div>
            </section>

            {/* Секция 5: Информация о системе (без строки "Поддержка") */}
            <section className="set-page-section">
              <h2 className="set-page-section-title">О системе</h2>
              
              <div className="set-page-system-info">
                <div className="set-page-system-info-item">
                  <strong>Название:</strong> QuickDiagnosis
                </div>
                <div className="set-page-system-info-item">
                  <strong>Версия:</strong> 2.0.0
                </div>
                <div className="set-page-system-info-item">
                  <strong>Тип лицензии:</strong> Бесплатная
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

SettingsPage.displayName = 'SettingsPage';

export default SettingsPage;