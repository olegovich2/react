// src/components/AccountPage/context/AccountContext.tsx
import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import { Survey, UploadedImage } from '../types/account.types'; // ← Локальные типы!

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
  
  // Обновление данных
  refreshSurveys: () => void;
  refreshImages: () => void;
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
  
  // Функции обновления данных
  const refreshSurveys = () => {
    console.log('Обновление опросов...');
  };
  
  const refreshImages = () => {
    console.log('Обновление изображений...');
  };

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
    refreshSurveys,
    refreshImages,
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
};