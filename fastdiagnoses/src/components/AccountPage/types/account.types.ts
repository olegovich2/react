// src/components/AccountPage/types/account.types.ts

// ==================== БАЗОВЫЕ ТИПЫ ====================
export interface APIResponse {
  success: boolean;
  message?: string;
  status?: number;
  field?: string;
  responseTime?: number;
  data?: any;
}

// ==================== ОПРОСЫ ====================
export interface Survey {
  id: number;
  date: string;
  nameSurname: string;
  age: string;
  temperature: string;
  anamnesis: string;
  title: string[];
  diagnostic: string[];
  treatment: string[];
  otherGuidelines: string[];
  survey?: string | object; // Для обратной совместимости
  created_at?: string;      // Дата создания записи
}

export interface SurveyResponse {
  success: boolean;
  message?: string;
  surveyId?: number;
}

export interface GetSurveysResponse {
  success: boolean;
  surveys: Survey[];
  message?: string;
}

export interface PaginatedSurveysResponse {
  success: boolean;
  surveys: Survey[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  message?: string;
}

// ==================== ИЗОБРАЖЕНИЯ ====================
export interface UploadedImage {
  id: number;
  fileUuid?: string;       // Уникальный идентификатор файла
  fileName: string;        // Оригинальное имя файла
  comment: string;         // Комментарий пользователя
  smallImage?: string;     // Base64 превью для совместимости
  originIMG?: string;      // Base64 оригинал для совместимости
  imageUrl?: string;       // URL к файлу на диске
  thumbnailUrl?: string;   // URL к превью на диске
  isFileOnDisk?: boolean;  // Флаг наличия файла на диске
  fileSize?: number;       // Размер файла в байтах
  dimensions?: string;     // Размеры изображения (ширинаxвысота)
  created_at?: string;     // Дата создания
}

export interface ImageUploadResponse {
  success: boolean;
  message: string;
  fileUuid?: string;
  imageId?: number;
}

export interface GetImageResponse {
  success: boolean;
  filename: string;
  image?: string;          // Base64 для совместимости
  imageUrl?: string;       // URL для файловой системы
  isFileOnDisk?: boolean;
  fileUuid?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  dimensions?: string;
  message?: string;
}

export interface PaginatedImagesResponse {
  success: boolean;
  images: UploadedImage[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  message?: string;
}

// ==================== РЕЗУЛЬТАТЫ ОПРОСА ====================
export interface SurveyResult {
  survey: Survey;
  recommendations?: {
    titles: string[];
    diagnostic: string[];
    treatment: string[];
  };
  createdAt?: string;
}

// ==================== УДАЛЕНИЕ ====================
export interface DeleteResponse {
  success: boolean;
  message: string;
  deletedId?: number;
}

// ==================== ПАГИНАЦИЯ ====================
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

export interface PaginatedDataResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  type?: 'surveys' | 'images' | 'all';
  message?: string;
}

// ==================== СТАТИСТИКА ====================
export interface UsageStats {
  totalSurveys: number;
  totalImages?: number;
  lastActivity: string;
  storageUsed?: number; // в байтах
  surveysByMonth?: Array<{
    month: string;
    count: number;
  }>;
}

// ==================== ФОРМЫ ДАННЫХ ====================
export interface FormData {
  [key: string]: any;
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

// ==================== ЗАГРУЗКА ФАЙЛОВ ====================
export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  filename: string;
}

export interface FileValidationResult {
  valid: boolean;
  message?: string;
  errors?: string[];
}

// ==================== ИСТОРИЯ ДЕЙСТВИЙ ====================
export interface AccountHistoryItem {
  id: number;
  action: 'create' | 'update' | 'delete' | 'view' | 'upload' | 'download';
  entityType: 'survey' | 'image' | 'user';
  entityId: number;
  timestamp: string;
  details?: Record<string, any>;
}

// ==================== СТАТИСТИКА АККАУНТА ====================
export interface AccountStats {
  totalSurveys: number;
  totalImages: number;
  lastSurveyDate?: string;
  lastImageDate?: string;
  storageUsed: number; // в байтах
  surveysByMonth: Array<{
    month: string;
    count: number;
  }>;
}

// ==================== ФИЛЬТРЫ И СОРТИРОВКА ====================
export interface SurveyFilters {
  dateFrom?: string;
  dateTo?: string;
  nameContains?: string;
  hasImages?: boolean;
  sortBy?: 'date' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ImageFilters {
  dateFrom?: string;
  dateTo?: string;
  filenameContains?: string;
  hasComment?: boolean;
  sortBy?: 'filename' | 'createdAt' | 'size';
  sortOrder?: 'asc' | 'desc';
}

// ==================== ЭКСПОРТ ДАННЫХ ====================
export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'word';
  includeSurveys: boolean;
  includeImages: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ExportResult {
  success: boolean;
  url?: string;
  filename?: string;
  message?: string;
}

// ==================== НАСТРОЙКИ АККАУНТА ====================
export interface AccountSettings {
  autoSaveSurveys: boolean;
  compressImages: boolean;
  maxImageSize: number; // в МБ
  notifications: {
    email: boolean;
    push: boolean;
  };
  privacy: {
    showName: boolean;
    shareStatistics: boolean;
  };
}

// ==================== КОМПОНЕНТ ПРОПСЫ ====================
export interface SurveyListProps {
  surveys: Survey[];
  onView: (survey: Survey) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
  filters?: SurveyFilters;
}

export interface ImageGalleryProps {
  images: UploadedImage[];
  onView: (imageId: number) => void;
  onDelete: (imageId: number) => void;
  isLoading?: boolean;
  filters?: ImageFilters;
}

export interface ImageUploadProps {
  onUploadSuccess: () => void;
  maxSize?: number; // в МБ
  allowedTypes?: string[];
}

export interface ResultSurveyProps {
  survey: Survey;
  onClose: () => void;
  onSaveAsWord?: () => void;
  onPrint?: () => void;
}

// ==================== СОСТОЯНИЕ АККАУНТА ====================
export interface AccountState {
  surveys: Survey[];
  images: UploadedImage[];
  selectedSurvey: Survey | null;
  selectedImage: UploadedImage | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    surveys: SurveyFilters;
    images: ImageFilters;
  };
  stats: AccountStats | null;
}

// ==================== СОБЫТИЯ АККАУНТА ====================
export interface AccountEvent {
  type: 'survey_created' | 'survey_deleted' | 'image_uploaded' | 'image_deleted' | 'data_exported';
  data: any;
  timestamp: number;
  userId?: number;
}

// ==================== ТИПЫ ДЛЯ API ОТВЕТОВ ====================
export interface SurveysResponse extends APIResponse {
  data?: Survey[];
}

export interface ImagesResponse extends APIResponse {
  data?: UploadedImage[];
}

export interface AccountResponse extends APIResponse {
  data?: {
    surveys: Survey[];
    images: UploadedImage[];
    stats?: AccountStats;
  };
}

// ==================== ТИПЫ ДЛЯ КОНТЕКСТА ====================
export interface AccountContextType {
  surveys: Survey[];
  images: UploadedImage[];
  selectedSurvey: Survey | null;
  selectedImage: UploadedImage | null;
  showImageModal: boolean;
  isLoading: boolean;
  error: string | null;
  stats: AccountStats | null;
  setSurveys: (surveys: Survey[]) => void;
  setImages: (images: UploadedImage[]) => void;
  setSelectedSurvey: (survey: Survey | null) => void;
  setSelectedImage: (image: UploadedImage | null) => void;
  setShowImageModal: (show: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStats: (stats: AccountStats | null) => void;
  loadData: () => Promise<void>;
}

// ==================== ДИАГНОЗЫ ====================
export interface DiagnosisResult {
  titles: string[];
  diagnostic: string[];
  treatment: string[];
}

export interface SearchDiagnosesResponse {
  success: boolean;
  titles: string[];
  diagnostic: string[];
  treatment: string[];
  message?: string;
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

// ==================== ДОПОЛНИТЕЛЬНЫЕ ТИПЫ ====================
export interface User {
  id?: number;
  login: string;
  email: string;
  createdAt?: string;
  token?: string;
}

export interface Session {
  id: number;
  login: string;
  token: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AppEvent {
  type: string;
  data: any;
  timestamp: number;
  userId?: number;
}

export interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  source: string;
  userId?: number;
  metadata?: Record<string, any>;
}

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