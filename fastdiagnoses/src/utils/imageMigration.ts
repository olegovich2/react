// src/utils/imageMigration.ts
export const checkImageMigrationStatus = async () => {
  try {
    const response = await fetch('/api/migrate/status');
    return response.json();
  } catch {
    return { success: false, message: 'Сервер миграции недоступен' };
  }
};

export const migrateImagesToFileSystem = async () => {
  try {
    const response = await fetch('/api/migrate/images', { method: 'POST' });
    return response.json();
  } catch {
    return { success: false, message: 'Ошибка миграции' };
  }
};