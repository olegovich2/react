const rateLimit = require("express-rate-limit");
const logger = require("../../services/LoggerService"); // ← ДОБАВЛЕН ИМПОРТ

// Лимит на отправку заявок: 5 заявок в час с одного IP
const submitRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5, // максимум 5 запросов
  handler: (req, res) => {
    logger.warn("Превышен лимит отправки заявок техподдержки", {
      ip: req.ip,
      login: req.body?.login,
      path: req.path,
      user_agent: req.headers["user-agent"]?.substring(0, 100),
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      message: "Слишком много заявок. Пожалуйста, попробуйте через час.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит на проверку статуса: 30 запросов в 10 минут
const checkStatusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 30, // максимум 30 запросов
  handler: (req, res) => {
    logger.warn("Превышен лимит проверки статуса техподдержки", {
      ip: req.ip,
      public_id: req.params.publicId,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      message: "Слишком много запросов. Пожалуйста, подождите.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  submitRequestLimiter,
  checkStatusLimiter,
};
