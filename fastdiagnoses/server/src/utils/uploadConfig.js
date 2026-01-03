const multer = require("multer");
const { ValidationError } = require("./validators");
const config = require("../config");
const logger = require("../services/LoggerService"); // ← ДОБАВЛЕН ИМПОРТ

/**
 * Конфигурация Multer для загрузки изображений
 */
const uploadConfig = {
  // Хранилище в памяти (буфер)
  storage: multer.memoryStorage(),

  // Лимиты файлов
  limits: {
    fileSize: config.MAX_FILE_SIZE, // Максимальный размер (например, 15MB)
    files: 1, // Максимальное количество файлов за раз
  },

  // Фильтр файлов
  fileFilter: (req, file, cb) => {
    // Проверяем MIME-тип
    if (config.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      logger.warn("Попытка загрузки файла недопустимого типа", {
        mime_type: file.mimetype,
        original_name: file.originalname,
        size: file.size,
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
        user_agent: req.headers["user-agent"]?.substring(0, 100),
        timestamp: new Date().toISOString(),
      });

      cb(
        new ValidationError(
          `Недопустимый тип файла: ${
            file.mimetype
          }. Разрешены: ${config.ALLOWED_MIME_TYPES.join(", ")}`,
          "file"
        )
      );
    }
  },

  // Дополнительные настройки (опционально)
  onError: (error, next) => {
    logger.error("Критическая ошибка Multer при обработке загрузки файла", {
      error_message: error.message,
      error_name: error.name,
      error_stack: error.stack?.substring(0, 500),
      endpoint: error.req?.path,
      method: error.req?.method,
      ip: error.req?.ip,
      timestamp: new Date().toISOString(),
    });

    next(error);
  },
};

/**
 * Создает экземпляр Multer с конфигурацией
 */
function createUploader() {
  return multer(uploadConfig);
}

/**
 * Middleware для одиночной загрузки изображения
 */
const uploadSingleImage = createUploader().single("image");

/**
 * Middleware для множественной загрузки изображений
 * (если понадобится в будущем)
 */
const uploadMultipleImages = createUploader().array("images", 5); // максимум 5 файлов

/**
 * Проверяет, является ли файл изображением
 */
function isImageFile(file) {
  return config.ALLOWED_MIME_TYPES.includes(file.mimetype);
}

/**
 * Получает информацию о загружаемом файле для логов
 */
function getFileInfo(file) {
  if (!file) return null;

  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    bufferSize: file.buffer?.length || 0,
  };
}

module.exports = {
  uploadConfig,
  createUploader,
  uploadSingleImage,
  uploadMultipleImages,
  isImageFile,
  getFileInfo,
};
