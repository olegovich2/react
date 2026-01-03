const fs = require("fs").promises;
const path = require("path");
const config = require("../config");
const logger = require("../services/LoggerService"); // ← ДОБАВЛЕН ИМПОРТ

// Обеспечиваем существование директорий
async function ensureUploadDirs() {
  try {
    await fs.access(config.UPLOAD_DIR);
  } catch (error) {
    logger.warn("Директория uploads не существует, создаю...", {
      upload_dir: config.UPLOAD_DIR,
      error_message: error.message,
    });

    await fs.mkdir(config.UPLOAD_DIR, { recursive: true });
    logger.warn("Директория uploads создана", {
      upload_dir: config.UPLOAD_DIR,
    });
  }
}

// Получаем пути директорий пользователя
async function getUserUploadDirs(login) {
  const userDir = path.join(config.UPLOAD_DIR, login);
  const originalsDir = path.join(userDir, "originals");
  const thumbnailsDir = path.join(userDir, "thumbnails");

  return { userDir, originalsDir, thumbnailsDir };
}

// Создаем директории пользователя
async function ensureUserUploadDirs(login) {
  try {
    const { originalsDir, thumbnailsDir } = await getUserUploadDirs(login);

    await fs.mkdir(originalsDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });

    return { originalsDir, thumbnailsDir };
  } catch (error) {
    logger.error("Критическая ошибка создания директорий пользователя", {
      login: login,
      error_message: error.message,
      error_code: error.code,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

// Удаление изображения с диска
async function deleteImageFromDisk(fileUuid, login) {
  try {
    const { originalsDir, thumbnailsDir } = await getUserUploadDirs(login);

    // Ищем файл по UUID
    const files = await fs.readdir(originalsDir);
    const fileToDelete = files.find((f) => f.includes(fileUuid));

    if (fileToDelete) {
      const originalPath = path.join(originalsDir, fileToDelete);
      const thumbnailPath = path.join(thumbnailsDir, fileToDelete);

      await fs.unlink(originalPath);

      // Пытаемся удалить превью
      try {
        await fs.unlink(thumbnailPath);
      } catch (thumbnailError) {
        logger.warn("Не удалось удалить превью изображения", {
          file_uuid: fileUuid,
          login: login,
          thumbnail_path: thumbnailPath,
          error_message: thumbnailError.message,
        });
      }

      logger.warn("Изображение успешно удалено с диска", {
        file_uuid: fileUuid,
        login: login,
        original_path: originalPath,
        thumbnail_path: thumbnailPath,
        timestamp: new Date().toISOString(),
      });

      return true;
    } else {
      logger.warn("Файл для удаления не найден", {
        file_uuid: fileUuid,
        login: login,
        originals_dir: originalsDir,
        files_count: files.length,
      });
      return false;
    }
  } catch (error) {
    logger.error("Критическая ошибка удаления файла с диска", {
      file_uuid: fileUuid,
      login: login,
      error_message: error.message,
      error_stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
    });

    return false;
  }
}

module.exports = {
  ensureUploadDirs,
  getUserUploadDirs,
  ensureUserUploadDirs,
  deleteImageFromDisk,
};
