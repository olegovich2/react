const logger = require("../services/LoggerService");

function requestLogger() {
  return async (req, res, next) => {
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

    // Флаг, чтобы не логировать дважды
    let requestLogged = false;

    // Логируем начало запроса (только если это не статика)
    logger.debug("Начало обработки запроса", {
      type: "api_request_start",
      request_id: requestId,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"]?.substring(0, 200),
      timestamp: new Date().toISOString(),
    });

    // Объединенный обработчик для send и json
    const logRequest = (body, isJson = false) => {
      if (requestLogged) return; // Не логировать дважды

      const responseTime = Date.now() - startTime;

      // Не логируем статику
      if (res.statusCode === 304 || req.path.includes(".")) {
        return;
      }

      // Определяем, что логировать
      const adminId = req.admin?.id;
      const userLogin = req.user?.login || req.body?.login || null;

      logger.apiRequest({
        level: "info",
        type: "api_request",
        message: `API ${req.method} ${req.path} - ${res.statusCode}`,
        endpoint: req.path,
        method: req.method,
        status_code: res.statusCode,
        response_time_ms: responseTime,
        admin_id: adminId,
        user_login: userLogin,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"]?.substring(0, 200) || null,
        request_id: requestId,
        response_type: isJson ? "json" : "other",
      });

      requestLogged = true;
    };

    // Перехватываем send
    const originalSend = res.send;
    res.send = function (body) {
      logRequest(body, false);
      return originalSend.call(this, body);
    };

    // Перехватываем json
    const originalJson = res.json;
    res.json = function (body) {
      logRequest(body, true);
      return originalJson.call(this, body);
    };

    next();
  };
}

module.exports = requestLogger;
