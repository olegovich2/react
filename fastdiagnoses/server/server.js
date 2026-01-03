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
app.use(requestLogger()); // Логирует все запросы - ЭТОГО ДОСТАТОЧНО!

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

  // УБРАТЬ этот лог - requestLogger уже залогировал запрос
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

// ==================== ОБРАБОТКА ОШИБОК ====================
app.use((err, req, res, next) => {
  // requestLogger уже залогировал ошибку через res.json/res.send
  // УБРАТЬ дополнительное логирование здесь

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
  // УБРАТЬ этот лог - requestLogger уже залогировал
  res.sendFile(path.join(adminBuildPath, "index.html"));
});

app.get("*", (req, res) => {
  // УБРАТЬ этот лог - requestLogger уже залогировал
  res.sendFile(path.join(buildPath, "index.html"));
});

// ==================== ИНИЦИАЛИЗАЦИЯ И ЗАПУСК СЕРВЕРА ====================
async function initializeServer() {
  try {
    logger.info("Инициализация сервера...", {
      type: "server",
      action: "initialization",
      port: PORT,
      node_env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });

    await ensureUploadDirs();
    await emailService.initialize();
    await workerService.initWorkers();

    app.listen(PORT, () => {
      logger.info("Сервер запущен", {
        type: "server",
        action: "start",
        port: PORT,
        node_env: process.env.NODE_ENV,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });

      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`⏰ Текущее время сервера: ${new Date().toLocaleString()}`);

      // Статистика логгера (только в консоль для отладки)
      console.log("📊 Статистика логгера:", logger.getStats());

      startCleanupSchedule();
    });
  } catch (error) {
    logger.error("Ошибка инициализации сервера", {
      type: "server",
      action: "initialization",
      status: "failed",
      error_message: error.message,
      stack_trace: error.stack,
      timestamp: new Date().toISOString(),
    });
    console.error("Ошибка инициализации:", error);
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN HANDLERS ====================
process.on("SIGTERM", async () => {
  logger.warn("Получен SIGTERM, завершаю работу...", {
    type: "server",
    action: "shutdown",
    signal: "SIGTERM",
    timestamp: new Date().toISOString(),
  });

  try {
    await workerService.shutdown();
    await emailService.close();
    await logger.shutdown();
    logger.info("Сервер успешно завершил работу", {
      type: "server",
      action: "shutdown",
      signal: "SIGTERM",
      status: "completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Ошибка при завершении работы", {
      type: "server",
      action: "shutdown_error",
      signal: "SIGTERM",
      error_message: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.warn("Получен SIGINT, завершаю работу...", {
    type: "server",
    action: "shutdown",
    signal: "SIGINT",
    timestamp: new Date().toISOString(),
  });

  try {
    await workerService.shutdown();
    await emailService.close();
    await logger.shutdown();
    logger.info("Сервер успешно завершил работу", {
      type: "server",
      action: "shutdown",
      signal: "SIGINT",
      status: "completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Ошибка при завершении работы", {
      type: "server",
      action: "shutdown_error",
      signal: "SIGINT",
      error_message: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  logger.error("Необработанное исключение", {
    type: "server",
    action: "uncaught_exception",
    error_message: error.message,
    stack_trace: error.stack,
    timestamp: new Date().toISOString(),
  });

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
    type: "server",
    action: "unhandled_rejection",
    reason: reason?.toString(),
    timestamp: new Date().toISOString(),
  });
});

initializeServer();
