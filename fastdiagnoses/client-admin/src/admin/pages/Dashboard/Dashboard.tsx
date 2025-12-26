import React, { useState, useEffect } from "react";
import { dashboardService } from "../../services/adminApi";
import { DashboardStats } from "../../types/index";
import "./Dashboard.css";

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("📊 [Dashboard] Компонент смонтирован");
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    console.log("🔄 [Dashboard] Начинаю обновление статистики...");
    setIsLoading(true);
    setError(null);

    try {
      console.log("📡 [Dashboard] Отправляю запрос к API...");
      const response = await dashboardService.getStats();
      console.log("✅ [Dashboard] Ответ от API:", {
        success: response.success,
        hasData: !!response.data,
        data: response.data,
      });

      if (response.success && response.data) {
        console.log("📊 [Dashboard] Данные получены:", response.data);
        setStats(response.data as DashboardStats);
      } else {
        console.error("❌ [Dashboard] Ошибка в ответе:", response.message);
        setError(response.message || "Не удалось загрузить статистику");
      }
    } catch (error: any) {
      console.error("💥 [Dashboard] Ошибка при обновлении:", error.message);
      setError(error.message || "Ошибка при загрузке данных");
    } finally {
      console.log("🏁 [Dashboard] Завершено обновление");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    console.log("⏳ [Dashboard] Показываем загрузку");
    return (
      <div className="admin-dashboard">
        <div className="admin-dashboard-loading">
          <div className="admin-dashboard-spinner"></div>
          <p>Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.log("❌ [Dashboard] Показываем ошибку:", error);
    return (
      <div className="admin-dashboard">
        <div className="admin-dashboard-error">
          <div className="admin-dashboard-error-icon">⚠️</div>
          <div className="admin-dashboard-error-content">
            <h3>Ошибка загрузки</h3>
            <p>{error}</p>
            <button
              onClick={fetchDashboardStats}
              className="admin-dashboard-retry-button"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log("✅ [Dashboard] Показываем данные статистики");
  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <h2 className="admin-dashboard-title">Общая статистика системы</h2>
        <button
          onClick={fetchDashboardStats}
          className="admin-dashboard-refresh-button"
          title="Обновить данные"
        >
          🔄 Обновить
        </button>
      </div>

      <div className="admin-dashboard-stats-grid">
        <div className="admin-dashboard-stat-card">
          <div className="admin-dashboard-stat-icon">👥</div>
          <div className="admin-dashboard-stat-content">
            <h3 className="admin-dashboard-stat-title">Пользователи</h3>
            <div className="admin-dashboard-stat-value">
              {stats?.totalUsers || 0}
            </div>
            <div className="admin-dashboard-stat-subtitle">
              Активных: {stats?.activeUsers || 0}
            </div>
          </div>
        </div>

        <div className="admin-dashboard-stat-card">
          <div className="admin-dashboard-stat-icon">🖼️</div>
          <div className="admin-dashboard-stat-content">
            <h3 className="admin-dashboard-stat-title">Изображения</h3>
            <div className="admin-dashboard-stat-value">
              {stats?.totalImages || 0}
            </div>
            <div className="admin-dashboard-stat-subtitle">Загружено всего</div>
          </div>
        </div>

        <div className="admin-dashboard-stat-card">
          <div className="admin-dashboard-stat-icon">📝</div>
          <div className="admin-dashboard-stat-content">
            <h3 className="admin-dashboard-stat-title">Опросы</h3>
            <div className="admin-dashboard-stat-value">
              {stats?.totalSurveys || 0}
            </div>
            <div className="admin-dashboard-stat-subtitle">Заполнено анкет</div>
          </div>
        </div>

        <div className="admin-dashboard-stat-card">
          <div className="admin-dashboard-stat-icon">💾</div>
          <div className="admin-dashboard-stat-content">
            <h3 className="admin-dashboard-stat-title">Хранилище</h3>
            <div className="admin-dashboard-stat-value">
              {stats?.storageUsed || "0 MB"}
            </div>
            <div className="admin-dashboard-stat-subtitle">
              Использовано диска
            </div>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-section">
        <div className="admin-dashboard-section-header">
          <h3 className="admin-dashboard-section-title">
            Последняя активность
          </h3>
          <span className="admin-dashboard-section-count">
            {stats?.recentActivity?.length || 0} записей
          </span>
        </div>

        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="admin-dashboard-activity-list">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="admin-dashboard-activity-item">
                <div className="admin-dashboard-activity-icon">
                  {getActivityIcon(activity.action)}
                </div>
                <div className="admin-dashboard-activity-content">
                  <div className="admin-dashboard-activity-action">
                    {activity.action}
                  </div>
                  <div className="admin-dashboard-activity-details">
                    <span className="admin-dashboard-activity-user">
                      {activity.user}
                    </span>
                    <span className="admin-dashboard-activity-time">
                      {formatTime(activity.timestamp)}
                    </span>
                    {activity.ip && (
                      <span className="admin-dashboard-activity-ip">
                        IP: {activity.ip}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-dashboard-empty">
            <div className="admin-dashboard-empty-icon">📭</div>
            <p className="admin-dashboard-empty-text">
              Нет данных об активности
            </p>
          </div>
        )}
      </div>

      <div className="admin-dashboard-footer">
        <div className="admin-dashboard-system-info">
          <div className="admin-dashboard-system-item">
            <span className="admin-dashboard-system-label">
              Версия системы:
            </span>
            <span className="admin-dashboard-system-value">2.0.0</span>
          </div>
          <div className="admin-dashboard-system-item">
            <span className="admin-dashboard-system-label">
              Последнее обновление:
            </span>
            <span className="admin-dashboard-system-value">
              {new Date().toLocaleDateString("ru-RU")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Вспомогательные функции
const getActivityIcon = (action: string): string => {
  if (action.includes("вошел") || action.includes("логин")) return "🔐";
  if (action.includes("загрузил")) return "📤";
  if (action.includes("удалил")) return "🗑️";
  if (action.includes("создал")) return "➕";
  if (action.includes("изменил")) return "✏️";
  return "📝";
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
};

Dashboard.displayName = "Dashboard";
export default Dashboard;
