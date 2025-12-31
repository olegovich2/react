// config.js
const path = require("path");

// URL для поддержки
const getSupportUrl = () => {
  const baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
  return `${baseUrl}/support`;
};

// Константы приложения
module.exports = {
  // Лимиты
  MAX_USERS_PER_EMAIL: 4,
  MAX_SESSION_AGE: 2 * 60 * 60 * 1000, // 2 часа
  MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB

  // Пути - ВАЖНО: указываем абсолютные пути
  UPLOAD_DIR: path.join(process.cwd(), "UploadIMG"),
  UPLOAD_DIR_RELATIVE: "UploadIMG", // относительный путь для логирования

  // Валидация
  ALLOWED_MIME_TYPES: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp",
    "image/tiff",
    "image/svg+xml",
  ],

  // Cron расписание
  CRON_SCHEDULES: {
    CLEANUP_SESSIONS: "30 2 * * *", // 02:30
    CLEANUP_REGISTRATIONS: "0 3 * * *", // 03:00
    CLEANUP_TOKENS: "0 4 * * *", // 04:00
    CLEANUP_LOGIN_ATTEMPTS: "0 5 * * *", // 5:00
  },

  // Добавьте эти константы
  SUPPORT_URL: getSupportUrl(),
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "support@quickdiagnosis.ru",

  // Все URL в одном месте для удобства
  URLS: {
    support: getSupportUrl(),
    resetPassword: (token) =>
      `${
        process.env.CLIENT_URL || "http://localhost:3000"
      }/reset-password/${token}`,
    confirmEmail: (token) =>
      `${process.env.CLIENT_URL || "http://localhost:3000"}/confirm/${token}`,
    login: `${process.env.CLIENT_URL || "http://localhost:3000"}/login`,
    register: `${process.env.CLIENT_URL || "http://localhost:3000"}/register`,
  },
};
