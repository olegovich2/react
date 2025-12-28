// src/components/AccountPage/context/AccountContext.tsx
import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction, useEffect, useCallback } from 'react';
import { Survey, UploadedImage } from '../types/account.types'; // ← Локальные типы!

interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// Ключи для localStorage
const STORAGE_KEYS = {
  SURVEYS_PAGINATION: 'account_surveys_pagination',
  IMAGES_PAGINATION: 'account_images_pagination',
  SURVEYS_FILTERS: 'account_surveys_filters',
  IMAGES_FILTERS: 'account_images_filters'
};

// Функции для работы с localStorage
const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`❌ Ошибка сохранения в localStorage (${key}):`, error);
  }
};

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`❌ Ошибка загрузки из localStorage (${key}):`, error);
    return defaultValue;
  }
};

interface AccountContextType {
  // Общие состояния
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  
  // Для опросов
  surveys: Survey[];
  setSurveys: Dispatch<SetStateAction<Survey[]>>;
  selectedSurvey: Survey | null;
  setSelectedSurvey: Dispatch<SetStateAction<Survey | null>>;
  showSurveyModal: boolean;
  setShowSurveyModal: Dispatch<SetStateAction<boolean>>;
  
  // Для изображений
  images: UploadedImage[];
  setImages: Dispatch<SetStateAction<UploadedImage[]>>;
  selectedImage: UploadedImage | null;
  setSelectedImage: Dispatch<SetStateAction<UploadedImage | null>>;
  showImageModal: boolean;
  setShowImageModal: Dispatch<SetStateAction<boolean>>;
  
  // Пагинация опросов
  surveysPagination: PaginationState;
  setSurveysPagination: Dispatch<SetStateAction<PaginationState>>;
  
  // Пагинация изображений
  imagesPagination: PaginationState;
  setImagesPagination: Dispatch<SetStateAction<PaginationState>>;
  
  // Фильтры и сортировка
  surveysFilters: any;
  setSurveysFilters: Dispatch<SetStateAction<any>>;
  imagesFilters: any;
  setImagesFilters: Dispatch<SetStateAction<any>>;
  
  // Обновление данных
  refreshSurveys: () => void;
  refreshImages: () => void;
  
  // Вспомогательные функции для пагинации
  updateSurveysPage: (page: number) => void;
  updateImagesPage: (page: number) => void;
  
  // Сброс пагинации
  resetSurveysPagination: () => void;
  resetImagesPagination: () => void;
  adjustPaginationAfterDeletion: (
    type: 'surveys' | 'images', 
    currentItemsCount: number
  ) => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const useAccountContext = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccountContext must be used within AccountProvider');
  }
  return context;
};

interface AccountProviderProps {
  children: ReactNode;
}

export const AccountProvider: React.FC<AccountProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Фильтры с сохранением в localStorage
  const [surveysFilters, setSurveysFilters] = useState<any>(() => 
    loadFromStorage(STORAGE_KEYS.SURVEYS_FILTERS, {})
  );
  const [imagesFilters, setImagesFilters] = useState<any>(() => 
    loadFromStorage(STORAGE_KEYS.IMAGES_FILTERS, {})
  );
  
  // Пагинация опросов с восстановлением из localStorage
  const [surveysPagination, setSurveysPaginationState] = useState<PaginationState>(() => 
    loadFromStorage(STORAGE_KEYS.SURVEYS_PAGINATION, {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 5
    })
  );
  
  // Пагинация изображений с восстановлением из localStorage
  const [imagesPagination, setImagesPaginationState] = useState<PaginationState>(() => 
    loadFromStorage(STORAGE_KEYS.IMAGES_PAGINATION, {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 5
    })
  );
  
  // Сохранение пагинации при изменении
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SURVEYS_PAGINATION, surveysPagination);
  }, [surveysPagination]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.IMAGES_PAGINATION, imagesPagination);
  }, [imagesPagination]);
  
  // Сохранение фильтров при изменении
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SURVEYS_FILTERS, surveysFilters);
  }, [surveysFilters]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.IMAGES_FILTERS, imagesFilters);
  }, [imagesFilters]);
  
  // Обертки для setState с логированием
  const setSurveysPagination: Dispatch<SetStateAction<PaginationState>> = (newState) => {
    console.log('📊 Обновление пагинации опросов:', newState);
    setSurveysPaginationState(newState);
  };
  
  const setImagesPagination: Dispatch<SetStateAction<PaginationState>> = (newState) => {
    console.log('📊 Обновление пагинации изображений:', newState);
    setImagesPaginationState(newState);
  };
  
  // Функции обновления данных
  const refreshSurveys = () => {
    console.log('🔄 Обновление опросов...');
  };
  
  const refreshImages = () => {
    console.log('🔄 Обновление изображений...');
  };
  
  // Вспомогательные функции для обновления страниц
  const updateSurveysPage = (page: number) => {
    console.log(`📄 Переход на страницу опросов: ${page}`);
    setSurveysPagination(prev => ({
      ...prev,
      currentPage: page
    }));
  };
  
  const updateImagesPage = (page: number) => {
    console.log(`📄 Переход на страницу изображений: ${page}`);
    setImagesPagination(prev => ({
      ...prev,
      currentPage: page
    }));
  };
  
  // Сброс пагинации
  const resetSurveysPagination = () => {
    console.log('🔄 Сброс пагинации опросов');
    setSurveysPagination({
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 5
    });
  };
  
  const resetImagesPagination = () => {
    console.log('🔄 Сброс пагинации изображений');
    setImagesPagination({
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 5
    });
  };

const adjustPaginationAfterDeletion = useCallback((
  type: 'surveys' | 'images',
  currentItemsCount: number
) => {
  if (type === 'surveys') {
    setSurveysPagination(prev => {
      const totalItems = Math.max(0, prev.totalItems - 1);
      const totalPages = Math.max(1, Math.ceil(totalItems / prev.itemsPerPage));
      const currentPage = prev.currentPage > totalPages ? totalPages : prev.currentPage;
      
      // Если на текущей странице больше нет элементов, переходим на предыдущую
      const newCurrentPage = currentItemsCount === 1 && currentPage > 1 
        ? currentPage - 1 
        : currentPage;
      
      return {
        ...prev,
        totalItems,
        totalPages,
        currentPage: newCurrentPage
      };
    });
  } else {
    setImagesPagination(prev => {
      const totalItems = Math.max(0, prev.totalItems - 1);
      const totalPages = Math.max(1, Math.ceil(totalItems / prev.itemsPerPage));
      const currentPage = prev.currentPage > totalPages ? totalPages : prev.currentPage;
      
      // Если на текущей странице больше нет элементов, переходим на предыдущую
      const newCurrentPage = currentItemsCount === 1 && currentPage > 1 
        ? currentPage - 1 
        : currentPage;
      
      return {
        ...prev,
        totalItems,
        totalPages,
        currentPage: newCurrentPage
      };
    });
  }
}, []);

  const value: AccountContextType = {
    isLoading,
    setIsLoading,
    surveys,
    setSurveys,
    selectedSurvey,
    setSelectedSurvey,
    showSurveyModal,
    setShowSurveyModal,
    images,
    setImages,
    selectedImage,
    setSelectedImage,
    showImageModal,
    setShowImageModal,
    surveysPagination,
    setSurveysPagination,
    imagesPagination,
    setImagesPagination,
    surveysFilters,
    setSurveysFilters,
    imagesFilters,
    setImagesFilters,
    refreshSurveys,
    refreshImages,
    updateSurveysPage,
    updateImagesPage,
    resetSurveysPagination,
    resetImagesPagination,
    adjustPaginationAfterDeletion
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
};

AccountContext.displayName='AccountContext';
useAccountContext.displayName='useAccountContext';
AccountProvider.displayName='AccountProvider';