const multer = require("multer");
const { ValidationError } = require("./validators");
const config = require("../config");

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
    console.error("❌ Ошибка Multer:", error.message);
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
