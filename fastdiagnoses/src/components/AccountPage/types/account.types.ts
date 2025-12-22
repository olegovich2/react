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

// ==================== СЫРЫЕ ДАННЫЕ С СЕРВЕРА ====================
export interface RawSurveyFromServer {
  id?: number;
  date?: string;
  nameSurname?: string;
  age?: string;
  temperature?: string;
  anamnesis?: string;
  title?: string[] | string;
  diagnostic?: string[] | string;
  treatment?: string[] | string;
  otherGuidelines?: string[] | string;
  survey?: string | object;
  user?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RawImageFromServer {
  id?: number;
  fileUuid?: string;
  fileName?: string;
  comment?: string;
  smallImage?: string;
  originIMG?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  storedFilename?: string;
  isFileOnDisk?: boolean;
  fileSize?: number;
  dimensions?: string;
  user?: string;
  created_at?: string;
}

// Типы для ответов API
export interface SurveysResponseData {
  surveys: RawSurveyFromServer[];
}

export interface PaginatedSurveysResponseData {
  surveys: RawSurveyFromServer[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface SingleSurveyResponseData {
  survey: Survey;
}

export interface ImagesResponseData {
  images: UploadedImage[];
}

export interface PaginatedImagesResponseData {
  images: UploadedImage[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface SingleImageResponseData {
  filename: string;
  image?: string;
  imageUrl?: string;
  isFileOnDisk?: boolean;
  fileUuid?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  dimensions?: string;
  comment?: string;
}

export interface DeleteResponseData {
  message: string;
}

export interface AuthLoginResponseData {
  token: string;
  user: {
    login: string;
    email: string;
    createdAt?: string;
  };
}

export interface AuthVerifyResponseData {
  user: {
    login: string;
    sessionId: number;
  };
}

export interface AllUserDataResponseData {
  surveys: RawSurveyFromServer[];
  images: any[];
}

export interface DiagnosisSearchResponseData {
  titles: string[];
  diagnostic: string[];
  treatment: string[];
}

// Типы для параметров запросов
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SearchParams {
  page?: number;
  limit?: number;
  type?: 'surveys' | 'images' | 'all';
  searchQuery?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}

// Типы для body запросов
export interface SaveSurveyBody {
  survey: Survey;
}

export interface SearchDiagnosesBody {
  titles: string[];
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
  fileUuid?: string;       
  fileName: string;       
  comment: string;         
  smallImage?: string;     
  originIMG?: string;      
  imageUrl?: string;       
  thumbnailUrl?: string;
  originalUrl?: string;
  storedFilename?: string; 
  isFileOnDisk?: boolean;  
  fileSize?: number;       
  dimensions?: string;     
  created_at?: string;     
}

export interface ImageUploadResponse {
  success: boolean;
  message: string;
  fileUuid?: string;
  imageId?: number;
  thumbnailUrl?: string;
  originalUrl?: string;
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
  comment?: string;
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
  onView: (image: UploadedImage) => void;
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

// ==================== УТИЛИТЫ ДЛЯ ТИПОВ ====================
/**
 * Конвертирует сырой опрос с сервера в нормализованный Survey
 */
export function normalizeSurvey(raw: RawSurveyFromServer): Survey {
  return {
    id: raw.id || 0,
    date: raw.date || '',
    nameSurname: raw.nameSurname || '',
    age: raw.age || '',
    temperature: raw.temperature || '',
    anamnesis: raw.anamnesis || '',
    title: Array.isArray(raw.title) ? raw.title : (raw.title ? [raw.title] : []),
    diagnostic: Array.isArray(raw.diagnostic) ? raw.diagnostic : (raw.diagnostic ? [raw.diagnostic] : []),
    treatment: Array.isArray(raw.treatment) ? raw.treatment : (raw.treatment ? [raw.treatment] : []),
    otherGuidelines: Array.isArray(raw.otherGuidelines) ? raw.otherGuidelines : (raw.otherGuidelines ? [raw.otherGuidelines] : []),
    survey: raw.survey,
    created_at: raw.created_at
  };
}

/**
 * Конвертирует сырое изображение с сервера в нормализованное UploadedImage
 */
export function normalizeImage(raw: RawImageFromServer): UploadedImage {
  return {
    id: raw.id || 0,
    fileUuid: raw.fileUuid,
    fileName: raw.fileName || '',
    comment: raw.comment || '',
    smallImage: raw.smallImage,
    originIMG: raw.originIMG,
    imageUrl: raw.imageUrl,
    thumbnailUrl: raw.thumbnailUrl,
    originalUrl: raw.originIMG,
    storedFilename: raw.storedFilename,
    isFileOnDisk: raw.isFileOnDisk,
    fileSize: raw.fileSize,
    dimensions: raw.dimensions,
    created_at: raw.created_at
  };
}