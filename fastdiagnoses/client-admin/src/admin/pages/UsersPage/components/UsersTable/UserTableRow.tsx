import React from "react";
import { User } from "../../../../types";
import UserRequestsCell from "./UserRequestsCell";
import UserActionsCell from "./UserActionsCell";
import "./UsersTable.css";

interface UserTableRowProps {
  user: User;
  isLoading: boolean;
  formatDate: (date: string) => string;
  formatBlockInfo: (user: User) => string | null;
  onBlockUser: (user: User) => void;
  onUnblockUser: (user: User) => Promise<void>;
  onRequestAction: (user: User, requestType: string) => Promise<User | null>;
  onResetPassword: (user: User) => Promise<void>;
}

// Вспомогательная функция для получения общего количества запросов
const getTotalRequests = (user: User): number => {
  return user.supportRequests?.total || 0;
};

// Вспомогательная функция для проверки просроченных запросов
const hasOverdueRequests = (user: User): boolean => {
  return user.supportRequests?.overdue || false;
};

// Функция для получения иконки статуса
const getStatusIcon = (user: User): string => {
  if (!user.isActive) return "❌";
  if (user.isBlocked) {
    return user.isPermanentlyBlocked ? "🔐" : "🔒";
  }
  return "✅";
};

// Функция для получения текста статуса
const getStatusText = (user: User): string => {
  if (!user.isActive) return "Неактивен";
  if (user.isBlocked) {
    return user.isPermanentlyBlocked
      ? "Заблокирован (бессрочно)"
      : "Заблокирован";
  }
  return "Активен";
};

// Функция для получения класса статуса
const getStatusClass = (user: User): string => {
  if (!user.isActive) return "inactive";
  if (user.isBlocked) {
    return user.isPermanentlyBlocked ? "permanently-blocked" : "blocked";
  }
  return "active";
};

// Функция для форматирования даты блокировки
const formatBlockDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateString;
  }
};

// Функция для получения информации о блокировке
const getBlockInfo = (
  user: User
): { text: string; icon: string; color: string } | null => {
  if (!user.isBlocked) return null;

  if (user.isPermanentlyBlocked) {
    return {
      text: "Бессрочно",
      icon: "🔐",
      color: "#c2185b",
    };
  }

  if (user.blockedUntilFormatted) {
    const dateText = formatBlockDate(user.blockedUntilFormatted);
    let text = `До: ${dateText}`;

    if (user.daysRemaining && user.daysRemaining > 0) {
      text += ` (${user.daysRemaining} дн.)`;
    }

    return {
      text,
      icon: "🔒",
      color: "#ef6c00",
    };
  }

  return {
    text: "Заблокирован",
    icon: "🔒",
    color: "#d32f2f",
  };
};

const UserTableRow: React.FC<UserTableRowProps> = ({
  user,
  isLoading,
  formatDate,
  onBlockUser,
  onUnblockUser,
  onRequestAction,
  onResetPassword,
}) => {
  const totalRequests = getTotalRequests(user);
  const hasOverdue = hasOverdueRequests(user);
  const statusClass = getStatusClass(user);
  const statusIcon = getStatusIcon(user);
  const statusText = getStatusText(user);
  const blockInfo = getBlockInfo(user);

  return (
    <tr
      key={user.id}
      className={`users-table-row ${hasOverdue ? "row-overdue" : ""}`}
    >
      {/* ЯЧЕЙКА ПОЛЬЗОВАТЕЛЯ */}
      <td className="users-table-user-cell">
        <div className="users-table-user-main">
          <div className="users-table-user-info">
            {/* Логин + ID */}
            <div className="users-table-user-login">
              <span>{user.login}</span>
              <span className="users-table-user-id">ID: {user.id}</span>
              {totalRequests > 0 && (
                <span
                  style={{
                    background: "#4a6cf7",
                    color: "white",
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontWeight: "600",
                  }}
                >
                  📩 {totalRequests}
                </span>
              )}
            </div>

            {/* Email */}
            <div className="users-table-user-email">
              <span className="users-table-user-email-icon">✉️</span>
              <span>{user.email}</span>
            </div>

            {/* Мета-информация */}
            <div className="users-table-user-meta">
              {/* Статус */}
              <span className={`users-table-status-badge ${statusClass}`}>
                <span className="users-table-user-meta-icon">{statusIcon}</span>
                <span>{statusText}</span>
              </span>

              {/* Дата регистрации */}
              <span className="users-table-user-meta-item">
                <span className="users-table-user-meta-icon">📅</span>
                <span>{formatDate(user.createdAt)}</span>
              </span>

              {/* Блокировка (если есть) */}
              {blockInfo && (
                <span
                  className="users-table-user-meta-item"
                  style={{
                    background: `${blockInfo.color}15`,
                    borderColor: `${blockInfo.color}30`,
                    color: blockInfo.color,
                    fontWeight: "600",
                  }}
                  title={blockInfo.text}
                >
                  <span className="users-table-user-meta-icon">
                    {blockInfo.icon}
                  </span>
                  <span>{blockInfo.text}</span>
                </span>
              )}

              {/* Сессии */}
              {user.activeSessions > 0 && (
                <span className="users-table-user-meta-item">
                  <span className="users-table-user-meta-icon">💻</span>
                  <span>{user.activeSessions} сессий</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* ЯЧЕЙКА ДАННЫХ */}
      <td className="users-table-data-cell">
        <div className="users-table-data-row">
          {/* Опросы */}
          <div className="users-table-data-item">
            <span className="users-table-data-label">Опросы:</span>
            <span className="users-table-data-value">{user.stats.surveys}</span>
            <span className="users-table-data-icon">📋</span>
          </div>

          {/* Изображения */}
          <div className="users-table-data-item">
            <span className="users-table-data-label">Изображения:</span>
            <span className="users-table-data-value">{user.stats.images}</span>
            <span className="users-table-data-icon">🖼️</span>
          </div>

          {/* Дополнительная информация о блокировке */}
          {user.isBlocked &&
            user.daysRemaining !== null &&
            user.daysRemaining !== undefined &&
            user.daysRemaining > 0 && (
              <div className="users-table-data-item">
                <span className="users-table-data-label">Осталось:</span>
                <span className="users-table-data-value">
                  {user.daysRemaining} дней
                </span>
                <span className="users-table-data-icon">⏳</span>
              </div>
            )}
        </div>
      </td>

      {/* ЯЧЕЙКА ЗАПРОСОВ */}
      <td className="users-table-requests-cell">
        <UserRequestsCell user={user} />
      </td>

      {/* ЯЧЕЙКА ДЕЙСТВИЙ */}
      <td className="users-table-actions-cell">
        <UserActionsCell
          user={user}
          isLoading={isLoading}
          onBlockUser={onBlockUser}
          onUnblockUser={onUnblockUser}
          onRequestAction={onRequestAction}
          onResetPassword={onResetPassword}
        />
      </td>
    </tr>
  );
};

UserTableRow.displayName = "UserTableRow";
export default UserTableRow;
