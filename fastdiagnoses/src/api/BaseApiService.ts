import { fetchClient } from './fetchClient';

/**
 * Базовый интерфейс для пагинации
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Стандартный ответ API
 */
export interface APIResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  status?: number;
  field?: string;
  responseTime?: number;
}

/**
 * Интерфейс для ответа сервера с пагинацией
 */
export interface PaginatedServerResponse {
  pagination: PaginationInfo;
  [key: string]: any; // Разрешаем другие поля любого типа
}

/**
 * Базовый класс для всех API сервисов
 * Инкапсулирует общую логику: пагинацию, обработку ошибок, преобразование данных
 */
export abstract class BaseApiService<T> {
  protected abstract endpoint: string;
  protected abstract entityName: string;

  /**
   * Получение данных с пагинацией (ОБЩАЯ ЛОГИКА)
   */
  async getPaginated(params?: { 
    page?: number; 
    limit?: number;
    [key: string]: any;
  }): Promise<APIResponse<{ items: T[]; pagination: PaginationInfo }>> {
    
    const page = params?.page || 1;
    const limit = params?.limit || 5;
    
    console.log(`📥 Запрос ${this.entityName} с пагинацией: страница ${page}, лимит ${limit}`);
    
    try {
      const response = await fetchClient.post<PaginatedServerResponse>(
        this.endpoint, 
        { page, limit, ...params }
      );
      
      if (response.success && response.data) {
        const items = this.extractItems(response.data);
        const processedItems = this.processItems(items);
        
        console.log(`✅ Получено ${processedItems.length} ${this.entityName} с пагинацией`);
        
        return {
          success: true,
          data: {
            items: processedItems,
            pagination: response.data.pagination
          },
          status: response.status,
          responseTime: response.responseTime
        };
      }
      
      return {
        success: false,
        message: response.message || `Ошибка получения ${this.entityName}`,
        status: response.status,
        field: response.field
      };
      
    } catch (error: any) {
      console.error(`❌ Ошибка получения ${this.entityName} с пагинацией:`, error);
      return {
        success: false,
        message: error.message || `Ошибка получения ${this.entityName}`,
        status: 0
      };
    }
  }

  /**
   * Получение элемента по ID (ОБЩАЯ ЛОГИКА)
   */
  async getById(id: number | string): Promise<APIResponse<T>> {
    console.log(`🔍 Получение ${this.entityName} с ID: ${id}`);
    
    try {
      const response = await fetchClient.get<any>(`${this.endpoint}/${id}`);
      
      if (response.success && response.data) {
        const item = this.extractSingleItem(response.data);
        const processedItem = this.processSingleItem(item);
        
        return {
          success: true,
          data: processedItem,
          status: response.status,
          responseTime: response.responseTime
        };
      }
      
      return {
        success: false,
        message: response.message || `${this.entityName} не найден`,
        status: response.status,
        field: response.field
      };
      
    } catch (error: any) {
      console.error(`❌ Ошибка получения ${this.entityName}:`, error);
      return {
        success: false,
        message: error.message || `Ошибка получения ${this.entityName}`,
        status: 0
      };
    }
  }

  /**
   * Удаление элемента (ОБЩАЯ ЛОГИКА)
   */
  async delete(id: number): Promise<APIResponse<{ message: string }>> {
    console.log(`🗑️ Удаление ${this.entityName} ${id}...`);
    
    try {
      const response = await fetchClient.delete<{ message: string }>(`/data/${id}`);
      
      return {
        success: response.success,
        message: response.message || (response.success ? `${this.entityName} удален` : `Ошибка удаления`),
        status: response.status,
        field: response.field
      };
      
    } catch (error: any) {
      console.error(`❌ Ошибка удаления ${this.entityName}:`, error);
      return {
        success: false,
        message: error.message || `Ошибка удаления ${this.entityName}`,
        status: 0
      };
    }
  }

  /**
   * Абстрактные методы для обработки специфичных данных (реализуются в дочерних классах)
   */
  
  /**
   * Извлечение массива элементов из ответа сервера
   */
  protected abstract extractItems(data: any): any[];

  /**
   * Преобразование сырых данных в типизированные элементы
   */
  protected abstract processItems(items: any[]): T[];

  /**
   * Извлечение одиночного элемента из ответа сервера
   */
  protected abstract extractSingleItem(data: any): any;

  /**
   * Преобразование сырых данных в типизированный элемент
   */
  protected abstract processSingleItem(item: any): T;
}