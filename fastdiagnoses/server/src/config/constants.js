// Константы приложения
module.exports = {
  // Лимиты
  MAX_USERS_PER_EMAIL: 4,
  MAX_SESSION_AGE: 2 * 60 * 60 * 1000, // 2 часа
  MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB

  // Пути
  UPLOAD_DIR: "UploadIMG",

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
  },
};
