const express = require("express");
const router = express.Router();
const SupportController = require("../controllers/SupportController");
const {
  submitRequestLimiter,
  checkStatusLimiter,
} = require("../middleware/rateLimit");
const logger = require("../../services/LoggerService"); // ← ДОБАВЛЕН ИМПОРТ

// Логирование всех запросов к техподдержке
router.use((req, res, next) => {
  logger.debug("Запрос к техподдержке", {
    method: req.method,
    path: req.path,
    ip: req.ip,
    user_agent: req.headers["user-agent"]?.substring(0, 200),
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

// 5. Детали заявки для админа
router.get("/details/:requestId", SupportController.getRequestDetails);

// ==================== ОБРАБОТЧИКИ ОШИБОК ====================

router.use((req, res) => {
  logger.warn("Роут техподдержки не найден", {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message: "Маршрут техподдержки не найден",
  });
});

router.use((err, req, res, next) => {
  logger.error("Ошибка в роутах техподдержки", {
    error_message: err.message,
    error_stack: err.stack?.substring(0, 500),
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  res.status(500).json({
    success: false,
    message: "Ошибка сервера техподдержки",
  });
});

module.exports = router;
