const express = require("express");
const path = require("path");
const cors = require("cors");
const emailService = require("./src/utils/emailService");
const workerService = require("./src/services/workerService");
require("dotenv").config();
const config = require("./src/config");
const { ensureUploadDirs } = require("./src/utils/fileSystem");
const { startCleanupSchedule } = require("./src/utils/cron");

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
  console.error("Global error handler:", err);

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
  res.sendFile(path.join(adminBuildPath, "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// ==================== ИНИЦИАЛИЗАЦИЯ И ЗАПУСК СЕРВЕРА ====================
async function initializeServer() {
  try {
    await ensureUploadDirs();

    await emailService.initialize();

    await workerService.initWorkers();

    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`⏰ Текущее время сервера: ${new Date().toLocaleString()}`);

      startCleanupSchedule();
    });
  } catch (error) {
    console.error("Ошибка инициализации:", error);
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN HANDLERS ====================
process.on("SIGTERM", async () => {
  console.log("🛑 Получен SIGTERM, завершаю работу...");
  await workerService.shutdown();
  await emailService.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 Получен SIGINT, завершаю работу...");
  await workerService.shutdown();
  await emailService.close();
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  console.error("💥 Необработанное исключение:", error);
  await workerService.shutdown();
  await emailService.close();
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Необработанный промис:", reason);
});

initializeServer();
