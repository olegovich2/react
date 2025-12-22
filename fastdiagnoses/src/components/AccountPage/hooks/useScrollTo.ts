import { useCallback, useRef } from 'react';

// Опции прокрутки
interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
  offset?: number; // Дополнительный отступ в пикселях
}

// Результат хука
interface UseScrollToResult {
  elementRef: React.RefObject<HTMLDivElement | null>;
  registerRef: (ref: HTMLDivElement | null) => void;
  scrollToElement: (options?: ScrollOptions) => void;
}

/**
 * Универсальный хук для управления прокруткой к элементу
 */
export const useScrollTo = (): UseScrollToResult => {
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Регистрация рефа
  const registerRef = useCallback((ref: HTMLDivElement | null) => {
    elementRef.current = ref;
  }, []);

  // Функция прокрутки
  const scrollToElement = useCallback((options: ScrollOptions = {}) => {
    const {
      behavior = 'smooth',
      block = 'start',
      inline = 'nearest',
      offset = 0
    } = options;

    if (elementRef.current) {
      // Прокрутка с использованием scrollIntoView
      elementRef.current.scrollIntoView({
        behavior,
        block,
        inline
      });

      // Дополнительная прокрутка с отступом
      if (offset !== 0) {
        const elementPosition = elementRef.current.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior
        });
      }
    } else {
      console.warn('Element ref is not registered yet');
      
      // Fallback: прокрутка к верху страницы
      window.scrollTo({
        top: 0,
        behavior
      });
    }
  }, []);

  return {
    elementRef,
    registerRef,
    scrollToElement
  };
};

// Добавляем displayName для хука
useScrollTo.displayName = 'useScrollTo';