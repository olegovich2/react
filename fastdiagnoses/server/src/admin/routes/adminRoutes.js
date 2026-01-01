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

// Логирование всех запросов к админ API в admin_logs
router.use(async (req, res, next) => {
  try {
    if (req.admin) {
      await query(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.admin.id,
          "api_request",
          req.method + " " + req.path,
          req.ip || req.connection.remoteAddress,
          req.headers["user-agent"] || "Неизвестно",
        ]
      );
    }
  } catch (error) {
    // Логируем ошибку логирования в system_errors
    await query(
      `INSERT INTO system_errors 
       (error_type, error_message, endpoint, method, severity) 
       VALUES (?, ?, ?, ?, ?)`,
      ["api_logging", error.message, req.path, req.method, "low"]
    );
  }
  next();
});

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
router.get("/settings", isAdmin, AdminDashboardController.getSettings);
router.put("/settings", isAdmin, AdminDashboardController.updateSettings);

// Логирование ошибок 404 для админ API в system_errors
router.use(async (req, res) => {
  try {
    await query(
      `INSERT INTO system_errors 
       (error_type, error_message, endpoint, method, severity) 
       VALUES (?, ?, ?, ?, ?)`,
      ["api_404", "Админ API маршрут не найден", req.path, req.method, "low"]
    );
  } catch (error) {
    // Если не удалось записать в system_errors - игнорируем
  }

  res.status(404).json({
    success: false,
    message: "Админ API маршрут не найден",
  });
});

// Глобальный обработчик ошибок для админ API
router.use(async (err, req, res, next) => {
  try {
    await query(
      `INSERT INTO system_errors 
       (error_type, error_message, stack_trace, endpoint, method, user_login, severity) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "api_error",
        err.message,
        err.stack,
        req.path,
        req.method,
        req.admin?.username || "unknown",
        "high",
      ]
    );
  } catch (logError) {
    // Если даже system_errors не работает - критическая ситуация
    // В этом случае ничего не делаем, чтобы не зациклиться
  }

  res.status(500).json({
    success: false,
    message: "Внутренняя ошибка сервера в админ API",
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
});

module.exports = router;
