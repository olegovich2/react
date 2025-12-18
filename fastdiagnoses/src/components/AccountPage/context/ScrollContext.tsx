import React, { createContext, useContext, useRef, useCallback } from 'react';

// Типы элементов для прокрутки
export type ScrollElementType = 'surveys' | 'images';

interface ScrollContextType {
  // Refs для разных блоков
  surveysRef: React.RefObject<HTMLDivElement | null>;
  imagesRef: React.RefObject<HTMLDivElement | null>;
  
  // Функции для регистрации рефов
  registerSurveysRef: (ref: HTMLDivElement | null) => void;
  registerImagesRef: (ref: HTMLDivElement | null) => void;
  
  // Функция прокрутки
  scrollToElement: (elementType: ScrollElementType, options?: ScrollIntoViewOptions) => void;
}

// Создаем контекст
const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

// Провайдер контекста
export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const surveysRef = useRef<HTMLDivElement | null>(null);
  const imagesRef = useRef<HTMLDivElement | null>(null);

  // Регистрация рефов
  const registerSurveysRef = useCallback((ref: HTMLDivElement | null) => {
    surveysRef.current = ref;
  }, []);

  const registerImagesRef = useCallback((ref: HTMLDivElement | null) => {
    imagesRef.current = ref;
  }, []);

  // Универсальная функция прокрутки
  const scrollToElement = useCallback((
    elementType: ScrollElementType, 
    options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'start' }
  ) => {
    let targetRef: React.RefObject<HTMLDivElement | null>;
    
    switch (elementType) {
      case 'surveys':
        targetRef = surveysRef;
        break;
      case 'images':
        targetRef = imagesRef;
        break;
      default:
        console.warn(`Unknown element type: ${elementType}`);
        return;
    }
    
    if (targetRef.current) {
      targetRef.current.scrollIntoView(options);
      
      // Дополнительная прокрутка с учетом фиксированного хедера
      const headerHeight = 80; // Примерная высота хедера
      const elementPosition = targetRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    } else {
      console.warn(`Ref for ${elementType} is not registered yet`);
      
      // Fallback: прокрутка к верху страницы
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, []);

  const value = {
    surveysRef,
    imagesRef,
    registerSurveysRef,
    registerImagesRef,
    scrollToElement,
  };

  return (
    <ScrollContext.Provider value={value}>
      {children}
    </ScrollContext.Provider>
  );
};

// Хук для использования контекста
export const useScroll = (): ScrollContextType => {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScroll must be used within a ScrollProvider');
  }
  return context;
};