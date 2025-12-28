import { useCallback } from 'react';
import { userDataService } from '../auth/UserDataService'; // Или как импортируется ваш сервис

export const useAccountStorage = () => {
  const clearAccountStorage = useCallback(() => {
    userDataService.clearAccountStorage();
  }, []);

  const clearOnlyAccountStorage = useCallback(() => {
    userDataService.clearOnlyAccountStorage();
  }, []);

  return {
    clearAccountStorage,
    clearOnlyAccountStorage
  };
};