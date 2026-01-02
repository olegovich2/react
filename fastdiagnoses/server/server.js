const express = require("express");
const path = require("path");
const cors = require("cors");
const emailService = require("./src/utils/emailService");
const workerService = require("./src/services/workerService");
require("dotenv").config();
const config = require("./src/config");
const { ensureUploadDirs } = require("./src/utils/fileSystem");
const { startCleanupSchedule } = require("./src/utils/cron");

// ===================== ИМПОРТ ЛОГГЕРА ====================
const logger = require("./src/services/LoggerService");

// ===================== ИМПОРТ MIDDLEWARE ЛОГГИРОВАНИЯ ====================
const requestLogger = require("./src/middleware/requestLogger");

// =====================Клиентские импорты=============
const apiRoutes = require("./src/routes/index");

// ==================== АДМИН ИМПОРТЫ ====================
const adminRoutes = require("./src/admin/routes/adminRoutes");
// ==================== ТЕХПОДДЕРЖКА ИМПОРТЫ ===================
const supportRoutes = require("./src/support/routes/supportRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== ИСПОЛЬЗУЕМ КОНФИГИ ====================
const UPLOAD_DIR = config.UPLOAD_DIR;

// ==================== MIDDLEWARE ====================
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : "http://localhost:5000",
    credentials: true,
  })
);

// ==================== ЛОГГИРОВАНИЕ ВСЕХ ЗАПРОСОВ ====================
app.use(requestLogger()); // Логируем все запросы

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(UPLOAD_DIR));

const buildPath = path.join(__dirname, "..", "client", "build");
app.use(express.static(buildPath));

const adminBuildPath = path.join(__dirname, "..", "client-admin", "build");
app.use("/admin", express.static(adminBuildPath));

// ==================== API ENDPOINTS ====================
app.use("/api", apiRoutes);

// Мониторинг worker'ов
app.get("/api/admin/workers-stats", async (req, res) => {
  if (
    process.env.NODE_ENV !== "development" &&
    req.headers["x-admin-key"] !== process.env.ADMIN_KEY
  ) {
    return res.status(403).json({ success: false, message: "Доступ запрещен" });
  }

  // Логируем запрос к мониторингу
  logger.info("Запрос статистики worker'ов", {
    ip: req.ip,
    user_agent: req.headers["user-agent"],
  });

  res.json({
    success: true,
    workers: workerService.getStats(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// ==================== АДМИН API ====================
app.use("/api/admin", adminRoutes);

// =====================ТЕХПОДДЕРЖКА API ====================
app.use("/api/support", supportRoutes);

// ==================== ОБРАБОТКА ОШИБОК С ЛОГГИРОВАНИЕМ ====================
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  // Логируем ошибку
  logger.error("Глобальный обработчик ошибок", {
    error_message: err.message,
    error_stack: err.stack,
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
  });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
      field: err.field,
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Ошибка аутентификации",
    });
  }

  res.status(500).json({
    success: false,
    message: "Внутренняя ошибка сервера",
  });
});

// ==================== ВСЕ ОСТАЛЬНЫЕ ЗАПРОСЫ → REACT ====================
app.get("/admin*", (req, res) => {
  // Логируем запросы к админ панели
  logger.debug("Запрос к админ панели", {
    path: req.path,
    ip: req.ip,
  });
  res.sendFile(path.join(adminBuildPath, "index.html"));
});

app.get("*", (req, res) => {
  // Логируем запросы к клиентской части
  logger.debug("Запрос к клиентской части", {
    path: req.path,
    ip: req.ip,
  });
  res.sendFile(path.join(buildPath, "index.html"));
});

// ==================== ИНИЦИАЛИЗАЦИЯ И ЗАПУСК СЕРВЕРА ====================
async function initializeServer() {
  try {
    logger.info("Инициализация сервера...", { port: PORT });

    await ensureUploadDirs();
    await emailService.initialize();
    await workerService.initWorkers();

    app.listen(PORT, () => {
      logger.info(`Сервер запущен на порту ${PORT}`, {
        node_env: process.env.NODE_ENV,
        uptime: process.uptime(),
      });
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`⏰ Текущее время сервера: ${new Date().toLocaleString()}`);

      // Логируем статистику логгера
      console.log("📊 Статистика логгера:", logger.getStats());

      startCleanupSchedule();
    });
  } catch (error) {
    logger.error("Ошибка инициализации сервера", {
      error_message: error.message,
      error_stack: error.stack,
    });
    console.error("Ошибка инициализации:", error);
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN HANDLERS С ЛОГГИРОВАНИЕМ ====================
process.on("SIGTERM", async () => {
  logger.warn("Получен SIGTERM, завершаю работу...");
  console.log("🛑 Получен SIGTERM, завершаю работу...");

  try {
    await workerService.shutdown();
    await emailService.close();
    await logger.shutdown(); // Выключаем логгер
    logger.info("Сервер успешно завершил работу по SIGTERM");
  } catch (error) {
    logger.error("Ошибка при завершении работы по SIGTERM", {
      error_message: error.message,
    });
  }

  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.warn("Получен SIGINT, завершаю работу...");
  console.log("🛑 Получен SIGINT, завершаю работу...");

  try {
    await workerService.shutdown();
    await emailService.close();
    await logger.shutdown(); // Выключаем логгер
    logger.info("Сервер успешно завершил работу по SIGINT");
  } catch (error) {
    logger.error("Ошибка при завершении работы по SIGINT", {
      error_message: error.message,
    });
  }

  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  logger.error("Необработанное исключение", {
    error_message: error.message,
    error_stack: error.stack,
  });
  console.error("💥 Необработанное исключение:", error);

  try {
    await workerService.shutdown();
    await emailService.close();
    await logger.shutdown();
  } catch (shutdownError) {
    console.error("Ошибка при экстренном завершении:", shutdownError);
  }

  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Необработанный промис", {
    reason: reason.toString(),
    promise: promise.toString(),
  });
  console.error("💥 Необработанный промис:", reason);
});

initializeServer();
