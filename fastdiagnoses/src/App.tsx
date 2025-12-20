import React, { useEffect, Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ConfirmEmailPage from "../src/pages/ConfirmEmailPage";

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
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const MainPage = lazy(() => import("./pages/MainPage"));
const AccountPage = lazy(() => import("./components/AccountPage/AccountPage"));
const ImagePage = lazy(
  () => import("./components/AccountPage/pages/ImagePage/ImagePage")
);
const SurveyPage = lazy(
  () => import("./components/AccountPage/pages/SurveyPage/SurveyPage")
);

// Компонент для защищенных маршрутов
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");

  // Если нет токена или пользователя, перенаправляем на логин
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  try {
    // Проверяем, что user - валидный JSON
    JSON.parse(user);
    return <>{children}</>;
  } catch {
    // Если user невалидный JSON, очищаем и перенаправляем
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }
};

// Компонент для перенаправления аутентифицированных пользователей
const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");

  // Если пользователь уже аутентифицирован, перенаправляем на главную
  if (token && user) {
    try {
      JSON.parse(user);
      return <Navigate to="/" replace />;
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }

  return <>{children}</>;
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

    // Очистка устаревших данных из localStorage
    const cleanupOldData = () => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      // Проверяем давность сохраненных данных
      const lastCleanup = localStorage.getItem("lastCleanup");
      if (!lastCleanup || now - parseInt(lastCleanup) > oneDay) {
        // Удаляем старые временные данные
        const keysToRemove = ["tempSurvey", "tempImage", "uploadProgress"];
        keysToRemove.forEach((key) => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
          }
        });

        localStorage.setItem("lastCleanup", now.toString());
      }
    };

    cleanupOldData();

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
            {/* Публичные маршруты (только для неаутентифицированных) */}
            <Route
              path="/login"
              element={
                <AuthRedirect>
                  <LoginPage />
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

            {/* Защищенные маршруты (только для аутентифицированных) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />

            {/* Страница просмотра изображения */}
            <Route
              path="/account/images/:id"
              element={
                <ProtectedRoute>
                  <ImagePage />
                </ProtectedRoute>
              }
            />

            {/* Страница просмотра осмотра */}
            <Route
              path="/account/survey/:id"
              element={
                <ProtectedRoute>
                  <SurveyPage />
                </ProtectedRoute>
              }
            />

            {/* Страница аккаунта с другим портом (для совместимости) */}
            <Route
              path="/account7680"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/account7681"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />

            {/* Статические маршруты для совместимости со старыми URL */}
            <Route
              path="/main"
              element={
                <ProtectedRoute>
                  <Navigate to="/" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/main/account"
              element={
                <ProtectedRoute>
                  <Navigate to="/account" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/main/auth"
              element={<Navigate to="/register" replace />}
            />

            <Route
              path="/main/entry"
              element={<Navigate to="/login" replace />}
            />

            {/* Подтверждение email */}
            <Route path="/confirm/:token" element={<ConfirmEmailPage />} />

            {/* Старые маршруты для совместимости с изображениями */}
            <Route
              path="/image/:id"
              element={
                <ProtectedRoute>
                  <Navigate to="/account/images/:id" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/images/:id"
              element={
                <ProtectedRoute>
                  <Navigate to="/account/images/:id" replace />
                </ProtectedRoute>
              }
            />

            {/* Страницы ошибок (можно добавить позже) */}
            {/* <Route path="/error" element={<ErrorPage />} />
            <Route path="/main/auth/error" element={<AuthErrorPage />} />
            <Route path="/main/entry/error" element={<LoginErrorPage />} /> */}

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

export default App;
