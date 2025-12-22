/**
 * Базовые типы API для FastDiagnoses
 * Все типы, связанные с аккаунтом (опросы, изображения, пагинация) вынесены в account.types.ts
 * Все типы для регистрации вынесены в register.types.ts
 * Все типы для входа вынесены в login.types.ts
 * Все типы для контекста вынесены в context.types.ts
 */

// ==================== БАЗОВЫЕ ТИПЫ ====================
export interface APIResponse {
  success: boolean;
  message?: string;
  status?: number;
  field?: string;
  responseTime?: number;
  data?: any;
}

// ==================== ОШИБКИ ====================
export interface ValidationError {
  success: false;
  message: string;
  field?: string;
  status: number;
}

export interface ApiError {
  success: false;
  message: string;
  status: number;
  code?: string;
}

// ==================== HEALTH CHECK ====================
export interface HealthCheckResponse {
  success: boolean;
  message: string;
  timestamp: string;
  version: string;
  database: 'online' | 'offline';
  uptime?: number;
}
