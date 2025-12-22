/**
 * Базовые типы API для FastDiagnoses
 * Все типы, связанные с аккаунтом (опросы, изображения, пагинация) вынесены в account.types.ts
 * Все типы для регистрации вынесены в register.types.ts
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

// ==================== АУТЕНТИФИКАЦИЯ ====================
export interface LoginCredentials {
  login: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    login: string;
    email: string;
    createdAt?: string;
  };
  message?: string;
  status?: number;
}

export interface User {
  id?: number;
  login: string;
  email: string;
  createdAt?: string;
  token?: string;
}

export interface JWTVerifyResponse {
  success: boolean;
  user?: {
    login: string;
    sessionId: number;
  };
  message?: string;
}

// ==================== ДИАГНОЗЫ ====================
export interface DiagnosisResult {
  titles: string[];
  diagnostic: string[];
  treatment: string[];
}

export interface SearchDiagnosesRequest {
  titles: string[];
}

export interface SearchDiagnosesResponse {
  success: boolean;
  titles: string[];
  diagnostic: string[];
  treatment: string[];
  message?: string;
}

// ==================== СИСТЕМЫ ОРГАНОВ ====================
export type BodySystem = 
  | 'general' 
  | 'respiratory' 
  | 'cardiovascular' 
  | 'digestive' 
  | 'urinary' 
  | 'musculoskeletal';

export interface SystemSymptoms {
  [key: string]: any;
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

// ==================== EMAIL ПОДТВЕРЖДЕНИЕ ====================
export interface EmailConfirmationResponse {
  success: boolean;
  message: string;
}

// ==================== СЕССИЯ ====================
export interface Session {
  id: number;
  login: string;
  token: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// ==================== ФАЙЛЫ (ОБЩИЕ) ====================
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface FileValidationResult {
  valid: boolean;
  message?: string;
  errors?: string[];
}

// ==================== ВАЛИДАЦИЯ ====================
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  fields: Record<string, any>;
}

// ==================== КОМПОНЕНТЫ ====================
export interface Tab {
  id: string;
  label: string;
  icon?: string;
  component: React.ComponentType<any>;
  disabled?: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  exact?: boolean;
  roles?: string[];
}

// ==================== НАСТРОЙКИ ====================
export interface AppSettings {
  theme: 'light' | 'dark';
  language: 'ru' | 'en';
  notifications: boolean;
  autoSave: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

// ==================== ИСТОРИЯ ====================
export interface HistoryItem {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  changes: Record<string, any>;
  timestamp: string;
  userId: number;
  userName: string;
}

// ==================== ЭКСПОРТ/ИМПОРТ ====================
export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf';
  includeData: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  message?: string;
}

// ==================== ПОИСК И ФИЛЬТРЫ ====================
export interface SearchParams {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: 'survey' | 'image' | 'all';
  limit?: number;
  offset?: number;
}

export interface SearchResult<T> {
  success: boolean;
  data: T[];
  total: number;
  query?: string;
  filters?: Record<string, any>;
}

// ==================== УВЕДОМЛЕНИЯ ====================
export interface Notification {
  id: number;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// ==================== КОНФИГУРАЦИЯ ====================
export interface AppConfig {
  apiUrl: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  maxUsersPerEmail: number;
  sessionTimeout: number;
  enableAnalytics: boolean;
  version: string;
}