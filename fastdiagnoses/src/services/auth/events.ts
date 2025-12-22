/**
 * Константы событий аутентификации
 * Централизованное управление именами событий
 */

export const AUTH_EVENTS = {
  // События требующие аутентификации
  REQUIRED: 'auth-required',
  LOGGED_OUT: 'user-logged-out',
  SESSION_EXPIRED: 'session-expired',
  
  // События статуса аккаунта
  NOT_ACTIVATED: 'account-not-activated',
  ACTIVATED: 'account-activated',
  BLOCKED: 'account-blocked',
  
  // События ошибок
  CONNECTION_ERROR: 'connection-error',
  NETWORK_ERROR: 'network-error',
  SERVER_ERROR: 'server-error',
  
  // События успеха
  LOGIN_SUCCESS: 'login-success',
  LOGOUT_SUCCESS: 'logout-success',
  REGISTER_SUCCESS: 'register-success'
} as const;

export type AuthEventType = typeof AUTH_EVENTS[keyof typeof AUTH_EVENTS];

/**
 * Вспомогательные функции для работы с событиями
 */
export const EventHelpers = {
  /**
   * Отправка события
   */
  dispatch(eventType: AuthEventType, detail?: any): void {
    console.log(`🔔 Отправка события: ${eventType}`, detail || '');
    window.dispatchEvent(new CustomEvent(eventType, { detail }));
  },

  /**
   * Подписка на событие
   */
  subscribe(eventType: AuthEventType, handler: (event: CustomEvent) => void): () => void {
    const eventHandler = (event: Event) => handler(event as CustomEvent);
    window.addEventListener(eventType, eventHandler);
    
    return () => {
      window.removeEventListener(eventType, eventHandler);
    };
  },

  /**
   * Проверка наличия события
   */
  hasListeners(eventType: AuthEventType): boolean {
    // Браузеры не предоставляют API для проверки слушателей
    return true; // Всегда предполагаем что есть слушатели
  }
};