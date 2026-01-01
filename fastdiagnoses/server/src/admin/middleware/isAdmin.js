const jwt = require("jsonwebtoken");
const { query } = require("../../services/databaseService");
const config = require("../../config");

const isAdmin = async (req, res, next) => {
  try {
    // 1. Получаем токен из заголовка
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      // Логируем отсутствие токена в login_attempts
      try {
        await query(
          `INSERT INTO login_attempts (login, ip_address, success, user_agent, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [
            "unknown_admin",
            req.ip || req.connection.remoteAddress,
            0,
            req.headers["user-agent"] || "Неизвестно",
          ]
        );
      } catch (logError) {
        // Ошибка логирования пишем в system_errors
        await query(
          `INSERT INTO system_errors 
           (error_type, error_message, endpoint, method, severity) 
           VALUES (?, ?, ?, ?, ?)`,
          ["auth_logging", logError.message, req.path, req.method, "medium"]
        );
      }

      return res.status(401).json({
        success: false,
        message: "Требуется аутентификация",
      });
    }

    // 2. Проверяем JWT токен
    let decoded;
    try {
      const tokenSecret = config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO;
      decoded = jwt.verify(token, tokenSecret);
    } catch (jwtError) {
      // Логируем невалидный токен в login_attempts
      try {
        await query(
          `INSERT INTO login_attempts (login, ip_address, success, user_agent, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [
            decoded?.adminId ? "admin_" + decoded.adminId : "unknown_admin",
            req.ip || req.connection.remoteAddress,
            0,
            req.headers["user-agent"] || "Неизвестно",
          ]
        );
      } catch (logError) {
        // Ошибка логирования в system_errors
        await query(
          `INSERT INTO system_errors 
           (error_type, error_message, endpoint, method, severity) 
           VALUES (?, ?, ?, ?, ?)`,
          ["auth_logging", logError.message, req.path, req.method, "medium"]
        );
      }

      return res.status(403).json({
        success: false,
        message: "Недействительный или просроченный токен",
      });
    }

    // 3. Проверяем что пользователь - админ
    const admin = await query(
      `SELECT id, username, email, role, is_active, full_name, last_login, created_at
       FROM admin_users 
       WHERE id = ? AND is_active = TRUE`,
      [decoded.adminId]
    );

    if (admin.length === 0) {
      // Логируем отсутствие админа в login_attempts
      try {
        await query(
          `INSERT INTO login_attempts (login, ip_address, success, user_agent, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [
            "admin_" + decoded.adminId,
            req.ip || req.connection.remoteAddress,
            0,
            req.headers["user-agent"] || "Неизвестно",
          ]
        );
      } catch (logError) {
        // Ошибка логирования в system_errors
        await query(
          `INSERT INTO system_errors 
           (error_type, error_message, endpoint, method, severity) 
           VALUES (?, ?, ?, ?, ?)`,
          ["auth_logging", logError.message, req.path, req.method, "medium"]
        );
      }

      return res.status(403).json({
        success: false,
        message: "Доступ запрещен. Недостаточно прав.",
      });
    }

    // 4. Добавляем информацию об админе в запрос
    req.admin = admin[0];

    // 5. Логируем успешный вход админа в login_attempts
    try {
      await query(
        `INSERT INTO login_attempts (login, ip_address, success, user_agent, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [
          req.admin.username,
          req.ip || req.connection.remoteAddress,
          1,
          req.headers["user-agent"] || "Неизвестно",
        ]
      );
    } catch (loginLogError) {
      // Ошибка логирования в system_errors
      await query(
        `INSERT INTO system_errors 
         (error_type, error_message, endpoint, method, severity) 
         VALUES (?, ?, ?, ?, ?)`,
        ["auth_logging", loginLogError.message, req.path, req.method, "medium"]
      );
    }

    // 6. Логируем доступ в admin_logs
    try {
      await query(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.admin.id,
          "access",
          req.method + " " + req.path,
          req.ip || req.connection.remoteAddress,
          req.headers["user-agent"] || "Неизвестно",
        ]
      );
    } catch (logError) {
      // Ошибка логирования в system_errors
      await query(
        `INSERT INTO system_errors 
         (error_type, error_message, endpoint, method, severity) 
         VALUES (?, ?, ?, ?, ?)`,
        ["auth_logging", logError.message, req.path, req.method, "medium"]
      );
    }

    next();
  } catch (error) {
    // Логируем общую ошибку middleware в system_errors
    try {
      await query(
        `INSERT INTO system_errors 
         (error_type, error_message, stack_trace, endpoint, method, severity) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "auth_middleware",
          error.message,
          error.stack,
          req.path,
          req.method,
          "high",
        ]
      );
    } catch (logError) {
      // Если даже system_errors не работает - критическая ситуация
      // В этом случае ничего не делаем, чтобы не зациклиться
    }

    res.status(500).json({
      success: false,
      message: "Ошибка проверки прав доступа",
    });
  }
};

module.exports = isAdmin;
