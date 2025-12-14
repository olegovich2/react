/**
 * Типы для API FastDiagnoses
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

export interface RegisterCredentials {
  login: string;
  password: string;
  email: string;
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

// ==================== ОПРОСЫ ====================
export interface Survey {
  id: number;  
  diagnosis?: string[];
  recommendations?: string[];
  date: string;
  nameSurname: string;
  age: number;
  temperature: number;
  anamnesis: string;
  title: string[];
  diagnostic?: string[];
  treatment?: string[];
  otherGuidelines?: string[];
}

export interface SurveyResponse {
  success: boolean;
  message?: string;
  surveyId?: number;
}

export interface GetSurveysResponse {
  success: boolean;
  surveys: Survey[];
  images: UploadedImage[];
  message?: string;
}

// ==================== ИЗОБРАЖЕНИЯ ====================
export interface UploadedImage {
  id: number;
  fileName: string;
  comment: string;
  smallImage: string;
  originIMG?: string;
}

export interface ImageUploadRequest {
  filename: string;
  file: string; // base64
  comment?: string;
}

export interface ImageUploadResponse {
  success: boolean;
  message: string;
  imageId?: number;
}

export interface GetImageResponse {
  success: boolean;
  filename: string;
  image: string; // base64
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

// ==================== УНИВЕРСАЛЬНЫЕ ====================
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  message?: string;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
  deletedId?: number;
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

// ==================== ФОРМЫ ====================
export interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
  };
}

export interface FormData {
  [key: string]: any;
}

// ==================== РЕЗУЛЬТАТЫ ====================
export interface DiagnosisResultItem {
  id: number;
  name: string;
  description?: string;
  severity: 'low' | 'medium' | 'high';
  recommendations: string[];
  confidence: number; // 0-100%
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

// ==================== ФАЙЛЫ ====================
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

// ==================== СОБЫТИЯ ====================
export interface AppEvent {
  type: string;
  data: any;
  timestamp: number;
  userId?: number;
}

// ==================== ЛОГИРОВАНИЕ ====================
export interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  source: string;
  userId?: number;
  metadata?: Record<string, any>;
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
  includeImages: boolean;
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