const express = require("express");
const router = express.Router();
const SupportController = require("../controllers/SupportController");
const {
  submitRequestLimiter,
  checkStatusLimiter,
} = require("../middleware/rateLimit");

// Логирование всех запросов
router.use((req, res, next) => {
  console.log("📨 [SupportRoutes] Запрос:", {
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
  next();
});

// ==================== РОУТЫ ====================

// 1. Отправка заявки (с лимитом)
router.post("/submit", submitRequestLimiter, SupportController.submitRequest);

// 2. Подтверждение email
router.get("/confirm/:token", SupportController.confirmEmail);

// 3. Проверка статуса (с лимитом)
router.get(
  "/status/:publicId",
  checkStatusLimiter,
  SupportController.getRequestStatus
);

// 4. Типы заявок
router.get("/types", SupportController.getRequestTypes);

// ==================== ОБРАБОТЧИКИ ОШИБОК ====================

router.use((req, res) => {
  console.warn("🔍 [SupportRoutes] 404 - Роут не найден:", req.path);
  res.status(404).json({
    success: false,
    message: "Маршрут техподдержки не найден",
  });
});

router.use((err, req, res, next) => {
  console.error("💥 [SupportRoutes] Ошибка:", {
    error: err.message,
    path: req.path,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    message: "Ошибка сервера техподдержки",
  });
});

console.log("✅ [SupportRoutes] Роуты техподдержки зарегистрированы");
module.exports = router;
