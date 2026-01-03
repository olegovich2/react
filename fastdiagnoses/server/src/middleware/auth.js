const jwt = require("jsonwebtoken");
const config = require("../config");
const { query } = require("../services/databaseService");
const logger = require("../services/LoggerService");

const authenticateToken = async (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.requestId || Math.random().toString(36).substr(2, 9);

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("Аутентификация: отсутствует или неверный формат токена", {
        type: "auth",
        action: "token_validation",
        status: "failed",
        reason: "missing_or_invalid_format",
        endpoint: req.path,
        method: req.method,
        ip_address: req.ip,
        request_id: requestId,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(401).json({
        success: false,
        message: "Токен отсутствует или имеет неверный формат",
      });
    }

    const token = authHeader.split(" ")[1];
    const tokenPrefix = token.substring(0, 10) + "...";

    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET_TWO);
    } catch (jwtError) {
      logger.warn("Аутентификация: ошибка верификации JWT", {
        type: "auth",
        action: "jwt_verification",
        status: "failed",
        error_type: jwtError.name,
        error_message: jwtError.message,
        endpoint: req.path,
        method: req.method,
        ip_address: req.ip,
        token_prefix: tokenPrefix,
        request_id: requestId,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Неверный токен",
        });
      }
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Токен истек",
        });
      }
      throw jwtError;
    }

    // Логируем успешную верификацию JWT
    logger.info("Аутентификация: JWT верифицирован", {
      type: "auth",
      action: "jwt_verification",
      status: "success",
      user_login: decoded.login,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      token_prefix: tokenPrefix,
      request_id: requestId,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    // Проверяем сессию в БД
    const session = await query(
      "SELECT * FROM sessionsdata WHERE jwt_access = ? AND login = ?",
      [token, decoded.login]
    );

    if (session.length === 0) {
      logger.warn("Аутентификация: сессия не найдена", {
        type: "auth",
        action: "session_validation",
        status: "failed",
        reason: "session_not_found",
        user_login: decoded.login,
        endpoint: req.path,
        method: req.method,
        ip_address: req.ip,
        token_prefix: tokenPrefix,
        request_id: requestId,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(401).json({
        success: false,
        message: "Сессия не найдена или устарела",
      });
    }

    const sessionAge = Date.now() - new Date(session[0].date).getTime();
    const MAX_SESSION_AGE = config.MAX_SESSION_AGE;

    if (sessionAge > MAX_SESSION_AGE) {
      logger.warn("Аутентификация: сессия истекла", {
        type: "auth",
        action: "session_validation",
        status: "failed",
        reason: "session_expired",
        user_login: decoded.login,
        session_id: session[0].id,
        session_age_ms: sessionAge,
        max_session_age_ms: MAX_SESSION_AGE,
        endpoint: req.path,
        method: req.method,
        ip_address: req.ip,
        token_prefix: tokenPrefix,
        request_id: requestId,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Удаляем истекшую сессию
      await query("DELETE FROM sessionsdata WHERE jwt_access = ?", [token]);

      return res.status(401).json({
        success: false,
        message: "Сессия истекла",
      });
    }

    // Успешная аутентификация
    req.user = {
      login: decoded.login,
      token: tokenPrefix, // Сохраняем только префикс для безопасности
      sessionId: session[0].id,
    };

    logger.info("Аутентификация: успешная", {
      type: "auth",
      action: "authentication",
      status: "success",
      user_login: decoded.login,
      session_id: session[0].id,
      session_age_ms: sessionAge,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      request_id: requestId,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    next();
  } catch (error) {
    logger.error("Аутентификация: внутренняя ошибка", {
      type: "auth",
      action: "authentication",
      status: "error",
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      request_id: requestId,
      error_message: error.message,
      error_name: error.name,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка аутентификации",
    });
  }
};

module.exports = {
  authenticateToken,
};
