const express = require("express");
const router = express.Router();
const isAdmin = require("../middleware/isAdmin");

// Импорт контроллеров
const AdminAuthController = require("../controllers/AdminAuthController");
const AdminDashboardController = require("../controllers/AdminDashboardController");
const AdminUsersController = require("../controllers/AdminUsersController");

// ==================== АУТЕНТИФИКАЦИЯ ====================
router.post("/auth/login", AdminAuthController.login);
router.post("/auth/logout", isAdmin, AdminAuthController.logout);
router.post("/auth/verify", AdminAuthController.verify);
router.get("/auth/profile", isAdmin, AdminAuthController.getProfile);

// ==================== ДАШБОРД ====================
router.get("/dashboard/stats", isAdmin, AdminDashboardController.getStats);
router.get(
  "/dashboard/services",
  isAdmin,
  AdminDashboardController.getServicesStatus
);
router.get(
  "/dashboard/recent-activity",
  isAdmin,
  AdminDashboardController.getRecentActivity
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
router.get("/monitoring/workers", AdminDashboardController.getWorkersStatus); // Без isAdmin для мониторинга

// ==================== НАСТРОЙКИ ====================
router.get("/settings", isAdmin, AdminDashboardController.getSettings);
router.put("/settings", isAdmin, AdminDashboardController.updateSettings);

module.exports = router;
