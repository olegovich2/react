import React, { useEffect, Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ConfirmEmailPage from "./components/ConfirmEmailPage/ConfirmEmailPage";
import SupportConfirmPage from "./components/SupportPage/SupportConfirmPage/SupportConfirmPage";
import { AccountProvider } from './components/AccountPage/context/AccountContext';

// Компоненты для отображения во время загрузки
const LoadingSpinner = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "rgb(184, 198, 202)",
    }}
  >
    <div
      style={{
        textAlign: "center",
        color: "rgb(88, 96, 98)",
        fontSize: "18px",
      }}
    >
      Загрузка QuickDiagnosis...
    </div>
  </div>
);

// Ленивая загрузка страниц для оптимизации
const LoginPage = lazy(() => import("./components/LoginPage/LoginPage"));
const ForgotPasswordPage = lazy(
  () => import("./components/ForgotPasswordPage/ForgotPasswordPage")
);
const ResetPasswordPage = lazy(
  () => import("./components/ResetPasswordPage/ResetPasswordPage")
);
const RegisterPage = lazy(
  () => import("./components/RegisterPage/RegisterPage")
);
const RegisterSuccessPage = lazy(
  () => import("./components/RegisterSuccessPage/RegisterSuccessPage")
);
const MainPage = lazy(() => import("./components/MainPage/MainPage"));
const AccountPage = lazy(() => import("./components/AccountPage/AccountPage"));
const ImagePage = lazy(
  () => import("./components/AccountPage/pages/ImagePage/ImagePage")
);
const SurveyPage = lazy(
  () => import("./components/AccountPage/pages/SurveyPage/SurveyPage")
);
const SettingsPage = lazy(
  () => import("./components/AccountPage/pages/SettingsPage/SettingsPage")
);
const SupportPage = lazy(() => import("./components/SupportPage/SupportPage"));
const SupportStatusPage = lazy(
  () => import("./components/SupportPage/SupportStatusPage/SupportStatusPage")
);

// Функция для очистки ключей аккаунта из localStorage
const clearAccountStorage = (): void => {
  try {
    console.log("🧹 Очистка ключей аккаунта из localStorage");
    
    // Список ключей аккаунта для очистки
    const accountKeys = [
      'account_surveys_pagination',
      'account_images_pagination',
      'account_surveys_filters',
      'account_images_filters',
    ];
    
    // Очищаем каждый ключ
    accountKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️ Удален ключ аккаунта: ${key}`);
    });
    
    // Дополнительно: очищаем все ключи начинающиеся с 'account_'
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('account_')) {
        localStorage.removeItem(key);
        console.log(`🗑️ Удален ключ с префиксом account_: ${key}`);
      }
    });
    
    console.log("✅ Ключи аккаунта очищены");
  } catch (error) {
    console.error("❌ Ошибка очистки ключей аккаунта:", error);
  }
};

// Функция для полной очистки аутентификационных данных
const clearAuthData = (): void => {
  try {
    console.log("🔐 Очистка аутентификационных данных");
    
    // Очищаем аутентификационные данные
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    
    // Очищаем ключи аккаунта
    clearAccountStorage();
    
    console.log("✅ Аутентификационные данные очищены");
  } catch (error) {
    console.error("❌ Ошибка очистки аутентификационных данных:", error);
  }
};

// Компонент для защищенных маршрутов
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");

  // Если нет токена или пользователя, перенаправляем на логин
  if (!token || !user) {
    // Очищаем ключи аккаунта при редиректе на логин
    clearAccountStorage();
    return <Navigate to="/login" replace />;
  }

  try {
    // Проверяем, что user - валидный JSON
    JSON.parse(user);
    return <>{children}</>;
  } catch {
    // Если user невалидный JSON, очищаем ВСЁ и перенаправляем
    clearAuthData();
    return <Navigate to="/login" replace />;
  }
};

// Компонент для перенаправления аутентифицированных пользователей
const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();

  // Очищаем ключи аккаунта при заходе на страницу логина
  useEffect(() => {
    if (location.pathname === "/login") {
      console.log("🔑 Страница логина - очищаем ключи аккаунта");
      clearAccountStorage();
    }
  }, [location.pathname]);

  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");

  // Если пользователь уже аутентифицирован, перенаправляем на главную
  if (token && user) {
    try {
      JSON.parse(user);
      // ИСКЛЮЧЕНИЕ: не перенаправлять если пользователь на странице поддержки
      if (location.pathname === "/support") {
        return <>{children}</>;
      }
      return <Navigate to="/" replace />;
    } catch {
      // Если user невалидный JSON, очищаем ВСЁ
      clearAuthData();
    }
  }

  return <>{children}</>;
};

// Компонент-обертка для очистки при переходе на главную
const MainPageWrapper: React.FC = () => {
  // Очищаем ключи аккаунта при загрузке главной страницы
  useEffect(() => {
    console.log("🏠 Загружена главная страница - очищаем ключи аккаунта");
    clearAccountStorage();
  }, []);

  return <MainPage />;
};

// Компонент-обертка для страниц аккаунта
const AccountLayout: React.FC = () => {
  return <Outlet />;
};

// Компонент-обертка для страницы логина с очисткой
const LoginPageWrapper: React.FC = () => {
  // Очищаем ключи аккаунта при загрузке страницы логина
  useEffect(() => {
    console.log("🔑 Загружена страница логина - очищаем ключи аккаунта");
    clearAccountStorage();
  }, []);

  return <LoginPage />;
};

// Основной компонент приложения
const App: React.FC = () => {
  // Инициализация приложения
  useEffect(() => {
    // Логирование информации о версии и окружении
    if (process.env.NODE_ENV === "development") {
      console.log("QuickDiagnosis запущен в режиме разработки");
      console.log("API URL:", process.env.REACT_APP_API_URL);
      console.log("WebSocket URL:", process.env.REACT_APP_WS_URL);
    }

    // Обработчик обновления страницы
    const handleBeforeUnload = () => {
      // Сохраняем состояние аутентификации
      const user = localStorage.getItem("user");
      if (user) {
        sessionStorage.setItem("userBackup", user);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Публичные маршруты */}
            <Route
              path="/login"
              element={
                <AuthRedirect>
                  <LoginPageWrapper />
                </AuthRedirect>
              }
            />

            <Route
              path="/forgot-password"
              element={
                <AuthRedirect>
                  <ForgotPasswordPage />
                </AuthRedirect>
              }
            />

            <Route
              path="/reset-password/:token"
              element={
                <AuthRedirect>
                  <ResetPasswordPage />
                </AuthRedirect>
              }
            />

            <Route
              path="/register"
              element={
                <AuthRedirect>
                  <RegisterPage />
                </AuthRedirect>
              }
            />

            {/* Страница поддержки - ДОСТУПНА ДЛЯ ВСЕХ */}
            <Route path="/support" element={<SupportPage />} />

            {/* Страница успешной заявки - ДОСТУПНА ДЛЯ ВСЕХ */}
            <Route
              path="/support/confirm/:token"
              element={<SupportConfirmPage />}
            />
            {/* Страница просмотра заявки */}
            <Route
              path="/support/status/:requestId"
              element={<SupportStatusPage />}
            />

            {/* Страница успешной регистрации */}
            <Route
              path="/register-success"
              element={
                <AuthRedirect>
                  <RegisterSuccessPage />
                </AuthRedirect>
              }
            />

            {/* Подтверждение email */}
            <Route path="/confirm/:token" element={<ConfirmEmailPage />} />

            {/* Главная страница */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainPageWrapper />
                </ProtectedRoute>
              }
            />

            {/* =================================================== */}
            {/* МАРШРУТЫ АККАУНТА */}
            {/* =================================================== */}
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountProvider>
                    <AccountLayout />
                  </AccountProvider>
                </ProtectedRoute>
              }
            >
              {/* Главная страница аккаунта */}
              <Route index element={<AccountPage />} />

              {/* Просмотр опроса */}
              <Route path="survey/:id" element={<SurveyPage />} />

              {/* Просмотр изображения */}
              <Route path="images/original/:uuid" element={<ImagePage />} />

              {/* Настройки */}
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Маршрут по умолчанию (404) */}
            <Route
              path="*"
              element={
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    backgroundColor: "rgb(184, 198, 202)",
                    color: "rgb(88, 96, 98)",
                    flexDirection: "column",
                  }}
                >
                  <h1>404 - Страница не найдена</h1>
                  <p style={{ marginTop: "20px" }}>
                    <a
                      href="/"
                      style={{
                        color: "rgb(88, 96, 98)",
                        textDecoration: "none",
                        border: "2px solid rgb(88, 96, 98)",
                        padding: "10px 20px",
                        borderRadius: "4px",
                      }}
                    >
                      Вернуться на главную
                    </a>
                  </p>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
};

App.displayName = "App";

export default App;