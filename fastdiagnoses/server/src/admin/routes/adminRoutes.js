const express = require("express");
const router = express.Router();
const isAdmin = require("../middleware/isAdmin");
const { query } = require("../../services/databaseService");

// Импорт контроллеров
const AdminSupportController = require("../controllers/AdminSupportController");
const AdminAuthController = require("../controllers/AdminAuthController");
const AdminDashboardController = require("../controllers/AdminDashboardController");
const AdminUsersController = require("../controllers/AdminUsersController");
const AdminLogsController = require("../controllers/AdminLogsController");
const AdminBackupsController = require("../controllers/AdminBackupsController");
const AdminSystemController = require("../controllers/AdminSystemController");
const SupportController = require("../../support/controllers/SupportController");

// УБРАЛИ middleware логирования из начала файла
// Логирование теперь происходит через:
// 1. requestLogger middleware (для API логов)
// 2. isAdmin middleware (для admin_logs через logger)

// ==================== АУТЕНТИФИКАЦИЯ ====================
router.post("/auth/login", AdminAuthController.login);
router.post("/auth/logout", isAdmin, AdminAuthController.logout);
router.post("/auth/verify", AdminAuthController.verify);
router.get("/auth/profile", isAdmin, AdminAuthController.getProfile);

// ==================== ДАШБОРД ====================
router.get("/dashboard/stats", isAdmin, AdminDashboardController.getStats);
router.get(
  "/dashboard/activity",
  isAdmin,
  AdminDashboardController.getRecentActivity
);
router.get(
  "/dashboard/services",
  isAdmin,
  AdminDashboardController.getServicesStatus
);

// ==================== ПОЛЬЗОВАТЕЛИ ====================
router.get("/users", isAdmin, AdminUsersController.getUsers);
router.get("/users/:login", isAdmin, AdminUsersController.getUserDetails);
router.post(
  "/users/:login/reset-password",
  isAdmin,
  AdminUsersController.resetUserPassword
);
router.post(
  "/users/:login/change-email",
  isAdmin,
  AdminUsersController.changeUserEmail
);
router.delete("/users/:login", isAdmin, AdminUsersController.deleteUser);
router.post("/users/:login/block", isAdmin, AdminUsersController.blockUser);
router.post("/users/:login/unblock", isAdmin, AdminUsersController.unblockUser);

// ==================== ТЕХПОДДЕРЖКА ДЛЯ АДМИНОВ ====================
// Получить все запросы пользователя
router.get(
  "/support/user/:login/requests",
  isAdmin,
  AdminSupportController.getUserRequests
);

// Получить информацию о конкретном запросе
router.get(
  "/support/requests/:id",
  isAdmin,
  AdminSupportController.getRequestInfo
);

// АВТОМАТИЧЕСКАЯ проверка запроса (расшифровка + сравнение)
router.post(
  "/support/requests/:id/validate",
  isAdmin,
  AdminSupportController.validateRequest
);

// Обработка запроса (одобрить/отклонить)
router.post(
  "/support/requests/:id/process",
  isAdmin,
  AdminSupportController.processRequest
);

// ==================== EMAIL ЗАПРОСЫ ====================
router.get("/email-requests", isAdmin, AdminUsersController.getEmailRequests);
router.put(
  "/email-requests/:id/approve",
  isAdmin,
  AdminUsersController.approveEmailRequest
);
router.put(
  "/email-requests/:id/reject",
  isAdmin,
  AdminUsersController.rejectEmailRequest
);

// ==================== МОНИТОРИНГ ====================
router.get(
  "/monitoring/errors",
  isAdmin,
  AdminDashboardController.getSystemErrors
);
router.put(
  "/monitoring/errors/:id/resolve",
  isAdmin,
  AdminDashboardController.markErrorAsResolved
);
router.get("/monitoring/logs", isAdmin, AdminDashboardController.getAdminLogs);
router.get("/monitoring/workers", AdminDashboardController.getWorkersStatus);

// ==================== ЛОГИ БЭКАПЫ ====================
router.get("/logs", isAdmin, AdminLogsController.getCombinedLogs);
router.get("/logs/export", isAdmin, AdminLogsController.exportLogs);
router.delete("/logs/cleanup", isAdmin, AdminLogsController.cleanupOldLogs);

router.get("/backups", isAdmin, AdminBackupsController.getBackups);
router.post("/backups", isAdmin, AdminBackupsController.createBackup);
router.post(
  "/backups/:id/restore",
  isAdmin,
  AdminBackupsController.restoreBackup
);
router.delete("/backups/:id", isAdmin, AdminBackupsController.deleteBackup);

// ==================== СИСТЕМНЫЕ ====================
// ТЕХПОДДЕРЖКА
router.get(
  "/admin/request/:requestId",
  isAdmin,
  SupportController.getRequestDetails
);

// Диагностика и мониторинг
router.get(
  "/system/diagnostics",
  isAdmin,
  AdminSystemController.getSystemDiagnostics
);
router.get(
  "/system/connections",
  isAdmin,
  AdminSystemController.checkConnections
);

// Обслуживание
router.post(
  "/system/optimize-tables",
  isAdmin,
  AdminSystemController.optimizeTables
);
router.post("/system/clear-cache", isAdmin, AdminSystemController.clearCache);

// ==================== НАСТРОЙКИ ====================
// router.get("/settings", isAdmin, AdminDashboardController.getSettings);
// router.put("/settings", isAdmin, AdminDashboardController.updateSettings);

// Логирование ошибок 404 для админ API через логгер
const logger = require("../../services/LoggerService");
router.use(async (req, res) => {
  logger.warn("Админ API маршрут не найден", {
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
  });

  res.status(404).json({
    success: false,
    message: "Админ API маршрут не найден",
  });
});

// Глобальный обработчик ошибок для админ API через логгер
router.use(async (err, req, res, next) => {
  logger.error("Ошибка в админ API", {
    error_message: err.message,
    error_stack: err.stack?.substring(0, 500),
    endpoint: req.path,
    method: req.method,
    admin_username: req.admin?.username || "unknown",
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    message: "Внутренняя ошибка сервера в админ API",
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
});

module.exports = router;
