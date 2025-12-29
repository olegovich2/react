const express = require("express");
const router = express.Router();
const isAdmin = require("../middleware/isAdmin");

// Импорт контроллеров
const AdminSupportController = require("../controllers/AdminSupportController");
const AdminAuthController = require("../controllers/AdminAuthController");
const AdminDashboardController = require("../controllers/AdminDashboardController");
const AdminUsersController = require("../controllers/AdminUsersController");
const AdminLogsController = require("../controllers/AdminLogsController");
const AdminBackupsController = require("../controllers/AdminBackupsController");
const AdminSystemController = require("../controllers/AdminSystemController");
const SupportController = require("../../support/controllers/SupportController");

// Логирование всех запросов к админ API
router.use((req, res, next) => {
  console.log("🌐 [AdminRoutes] Запрос к админ API:", {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers["user-agent"]?.substring(0, 100),
    bodySize: JSON.stringify(req.body).length,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
  });
  next();
});

// ==================== АУТЕНТИФИКАЦИЯ ====================
console.log("🔐 [AdminRoutes] Регистрация роутов аутентификации");
router.post("/auth/login", AdminAuthController.login);
router.post("/auth/logout", isAdmin, AdminAuthController.logout);
router.post("/auth/verify", AdminAuthController.verify);
router.get("/auth/profile", isAdmin, AdminAuthController.getProfile);

// ==================== ДАШБОРД ====================
console.log("📊 [AdminRoutes] Регистрация роутов дашборда");
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
console.log("👥 [AdminRoutes] Регистрация роутов пользователей");
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
console.log("🛠️ [AdminRoutes] Регистрация роутов для техподдержки");

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
console.log("📧 [AdminRoutes] Регистрация роутов email запросов");
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
console.log("🚨 [AdminRoutes] Регистрация роутов мониторинга");
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
console.log("📋 [AdminRoutes] Регистрация роутов логов");
router.get("/logs", isAdmin, AdminLogsController.getCombinedLogs);
router.get("/logs/export", isAdmin, AdminLogsController.exportLogs);
router.delete("/logs/cleanup", isAdmin, AdminLogsController.cleanupOldLogs);

console.log("💾 [AdminRoutes] Регистрация роутов бэкапов");
router.get("/backups", isAdmin, AdminBackupsController.getBackups);
router.post("/backups", isAdmin, AdminBackupsController.createBackup);
router.post(
  "/backups/:id/restore",
  isAdmin,
  AdminBackupsController.restoreBackup
);
router.delete("/backups/:id", isAdmin, AdminBackupsController.deleteBackup);

// ==================== СИСТЕМНЫЕ ====================
console.log("⚙️ [AdminRoutes] Регистрация системных роутов");

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

// Расширенные настройки (будем дополнять)
// router.get(
//   "/system/settings/advanced",
//   isAdmin,
//   AdminSystemController.getAdvancedSettings
// );
// router.put(
//   "/system/settings/advanced",
//   isAdmin,
//   AdminSystemController.updateAdvancedSettings
// );

// ==================== НАСТРОЙКИ ====================
console.log("⚙️ [AdminRoutes] Регистрация роутов настроек");
router.get("/settings", isAdmin, AdminDashboardController.getSettings);
router.put("/settings", isAdmin, AdminDashboardController.updateSettings);

// Логирование ошибок 404 для админ API
router.use((req, res) => {
  console.warn("🔍 [AdminRoutes] 404 - Роут не найден:", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message: "Админ API маршрут не найден",
  });
});

// Глобальный обработчик ошибок для админ API
router.use((err, req, res, next) => {
  console.error("💥 [AdminRoutes] Глобальная ошибка:", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    adminId: req.admin?.id,
  });

  res.status(500).json({
    success: false,
    message: "Внутренняя ошибка сервера в админ API",
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
});

console.log("✅ [AdminRoutes] Все роуты зарегистрированы");
module.exports = router;
