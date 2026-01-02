const logger = require("../services/LoggerService");

function requestLogger() {
  return async (req, res, next) => {
    // Игнорируем статику, health-check и системные файлы
    const ignoredPaths = [
      "/static/",
      "/uploads/",
      "/favicon.ico",
      "/sockjs-node/",
      "/hot-update.json",
      "/health",
      "/robots.txt",
      "/manifest.json",
      "/service-worker.js",
    ];

    const ignoredExtensions = [
      ".css",
      ".js",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".ico",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".map",
      ".json",
    ];

    // Проверка на игнорируемые пути
    if (ignoredPaths.some((path) => req.path.includes(path))) {
      return next();
    }

    // Проверка на игнорируемые расширения
    if (ignoredExtensions.some((ext) => req.path.endsWith(ext))) {
      return next();
    }

    // Игнорировать запросы React Dev Server (если есть)
    if (
      req.headers["sec-fetch-dest"] === "script" ||
      req.headers["sec-fetch-dest"] === "style" ||
      req.headers["sec-fetch-dest"] === "image"
    ) {
      return next();
    }

    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    req.requestId = requestId;

    // Логируем начало запроса (только если это не статика)
    logger.debug("Начало обработки запроса", {
      request_id: requestId,
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      user_agent: req.headers["user-agent"]?.substring(0, 200),
    });

    // Перехватываем отправку ответа
    const originalSend = res.send;
    res.send = function (body) {
      const responseTime = Date.now() - startTime;

      // Логируем запрос только если это не статика
      if (res.statusCode !== 304 && !req.path.includes(".")) {
        logger.apiRequest(req, res, responseTime, requestId);
      }

      return originalSend.call(this, body);
    };

    // Перехватываем JSON ответ
    const originalJson = res.json;
    res.json = function (body) {
      const responseTime = Date.now() - startTime;

      // Всегда логируем JSON ответы (это API)
      logger.apiRequest(req, res, responseTime, requestId);

      return originalJson.call(this, body);
    };

    next();
  };
}

module.exports = requestLogger;
