require("dotenv").config();

module.exports = {
  // Включение/выключение логирования
  enabled: process.env.LOGGING_ENABLED !== "false",

  // Настройки буфера
  bufferSize: parseInt(process.env.LOG_BUFFER_SIZE) || 1000,
  batchSize: parseInt(process.env.LOG_BATCH_SIZE) || 100,
  flushInterval: parseInt(process.env.LOG_FLUSH_INTERVAL) || 5000,

  // Retry настройки
  maxRetries: parseInt(process.env.LOG_MAX_RETRIES) || 3,
  retryDelay: parseInt(process.env.LOG_RETRY_DELAY) || 1000,

  // Fallback настройки
  fallbackToFile: process.env.LOG_FALLBACK_TO_FILE !== "false",
  fallbackDir: process.env.LOG_FALLBACK_DIR || "logs",

  // Какие части системы логировать
  logParts: {
    admin: process.env.LOG_ADMIN !== "false",
    support: process.env.LOG_SUPPORT !== "false",
    client: process.env.LOG_CLIENT !== "false",
    api: process.env.LOG_API !== "false",
    system: process.env.LOG_SYSTEM !== "false",
  },
};
