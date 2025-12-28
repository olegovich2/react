const rateLimit = require("express-rate-limit");

// Лимит на отправку заявок: 5 заявок в час с одного IP
const submitRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5, // максимум 5 запросов
  message: {
    success: false,
    message: "Слишком много заявок. Пожалуйста, попробуйте через час.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит на проверку статуса: 30 запросов в 10 минут
const checkStatusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 30, // максимум 30 запросов
  message: {
    success: false,
    message: "Слишком много запросов. Пожалуйста, подождите.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  submitRequestLimiter,
  checkStatusLimiter,
};
