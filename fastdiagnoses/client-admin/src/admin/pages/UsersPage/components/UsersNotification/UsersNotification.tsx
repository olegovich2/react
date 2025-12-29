import React from 'react';
import './UsersNotification.css';

interface UsersNotificationProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}

const UsersNotification: React.FC<UsersNotificationProps> = ({
  type,
  message,
  onClose
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  return (
    <div className={`users-notification users-notification-${type}`}>
      <div className="users-notification-content">
        <span className="users-notification-icon">{getIcon()}</span>
        <span>{message}</span>
      </div>
      <button 
        onClick={onClose}
        className="users-notification-close"
      >
        ✕
      </button>
    </div>
  );
};

UsersNotification.displayName = 'UsersNotification';
export default UsersNotification;