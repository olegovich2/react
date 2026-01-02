const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../../services/databaseService");
const config = require("../../config");
const logger = require("../../services/LoggerService");

class AdminAuthService {
  // Логировать действие администратора
  static async logAdminAction(
    adminId,
    actionType,
    targetType,
    targetId,
    details,
    ip,
    userAgent
  ) {
    try {
      // Используем метод логгера для админских действий
      logger.adminAction(
        adminId,
        actionType,
        { type: targetType, id: targetId },
        details,
        ip,
        userAgent
      );

      // Добавляем info лог с полученными данными
      logger.info("Логирование действия администратора", {
        admin_id: adminId,
        action: actionType,
        target_type: targetType,
        target_id: targetId,
        has_details: !!details,
        ip_address: ip,
      });
    } catch (error) {
      logger.error("Ошибка логирования действия администратора", {
        error_message: error.message,
        admin_id: adminId,
        action: actionType,
      });
    }
  }

  // Вход администратора
  static async login(username, password, ip, userAgent) {
    const startTime = Date.now();

    // 1. logger.info: полученные данные
    logger.info("Попытка входа администратора - полученные данные", {
      username,
      ip,
      user_agent_length: userAgent?.length || 0,
    });

    try {
      // 1. Найти администратора
      const admin = await query(
        `SELECT id, username, password_hash, email, role, is_active, 
                login_attempts, locked_until, full_name
         FROM admin_users 
         WHERE username = ?`,
        [username]
      );

      if (admin.length === 0) {
        await this.logAdminAction(
          0,
          "failed_login",
          "auth",
          null,
          { username, reason: "user_not_found" },
          ip,
          userAgent
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Неверные учетные данные");
      }

      const adminData = admin[0];

      // 2. Проверка блокировки
      if (adminData.locked_until && adminData.locked_until > new Date()) {
        await this.logAdminAction(
          adminData.id,
          "failed_login",
          "auth",
          null,
          { reason: "account_locked", locked_until: adminData.locked_until },
          ip,
          userAgent
        );

        throw new Error("Аккаунт временно заблокирован");
      }

      // 3. Проверка пароля
      const validPassword = await bcrypt.compare(
        password,
        adminData.password_hash
      );

      if (!validPassword) {
        const updatedAttempts = adminData.login_attempts + 1;
        const lockAccount = updatedAttempts >= 5;
        const lockUntil = lockAccount
          ? `DATE_ADD(NOW(), INTERVAL 15 MINUTE)`
          : "locked_until";

        await query(
          `UPDATE admin_users 
           SET login_attempts = ?,
               locked_until = ${
                 lockAccount
                   ? "DATE_ADD(NOW(), INTERVAL 15 MINUTE)"
                   : "locked_until"
               }
           WHERE id = ?`,
          [updatedAttempts, adminData.id]
        );

        await this.logAdminAction(
          adminData.id,
          "failed_login",
          "auth",
          null,
          {
            reason: "invalid_password",
            attempts: updatedAttempts,
            will_lock: lockAccount,
          },
          ip,
          userAgent
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Неверные учетные данные");
      }

      // 4. Сброс счетчика неудачных попыток
      await query(
        `UPDATE admin_users 
         SET login_attempts = 0, 
             locked_until = NULL,
             last_login = NOW()
         WHERE id = ?`,
        [adminData.id]
      );

      // 5. Генерация JWT токена
      const tokenSecret = config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO;

      const token = jwt.sign(
        {
          adminId: adminData.id,
          username: adminData.username,
          role: adminData.role,
          email: adminData.email,
        },
        tokenSecret,
        { expiresIn: "8h" }
      );

      // 6. Сохраняем сессию
      await query(
        `INSERT INTO admin_sessions (admin_id, session_token, ip_address, user_agent, expires_at) 
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR))`,
        [adminData.id, token, ip, userAgent]
      );

      // 7. Очищаем старые сессии (оставляем последние 5)
      const cleanupResult = await query(
        `DELETE FROM admin_sessions 
         WHERE admin_id = ? AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM admin_sessions 
             WHERE admin_id = ? 
             ORDER BY created_at DESC 
             LIMIT 5
           ) AS latest
         )`,
        [adminData.id, adminData.id]
      );

      // 8. Логируем успешный вход
      await this.logAdminAction(
        adminData.id,
        "login",
        "auth",
        null,
        {
          method: "password",
          token_length: token.length,
          ip,
          user_agent: userAgent,
          old_sessions_cleaned: cleanupResult.affectedRows,
        },
        ip,
        userAgent
      );

      const totalTime = Date.now() - startTime;

      // 2. logger.info: результат операции
      logger.info("Вход администратора выполнен успешно", {
        admin_id: adminData.id,
        username: adminData.username,
        role: adminData.role,
        response_time_ms: totalTime,
        sessions_cleaned: cleanupResult.affectedRows,
      });

      return {
        success: true,
        token,
        admin: {
          id: adminData.id,
          username: adminData.username,
          email: adminData.email,
          role: adminData.role,
          fullName: adminData.full_name || adminData.username,
        },
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;

      logger.error("Ошибка входа администратора", {
        error_message: error.message,
        username,
        response_time_ms: totalTime,
        ip,
      });
      throw error;
    }
  }

  // Выход
  static async logout(token, adminId) {
    const startTime = Date.now();

    // 1. logger.info: полученные данные
    logger.info("Попытка выхода администратора - полученные данные", {
      admin_id: adminId,
      has_token: !!token,
      token_preview: token ? token.substring(0, 10) + "..." : "нет токена",
    });

    try {
      const result = await query(
        "DELETE FROM admin_sessions WHERE session_token = ?",
        [token]
      );

      await this.logAdminAction(
        adminId,
        "logout",
        "auth",
        null,
        {
          token_preview: token?.substring(0, 20) + "...",
          sessions_deleted: result.affectedRows,
        },
        null,
        null
      );

      const responseTime = Date.now() - startTime;

      // 2. logger.info: результат операции
      logger.info("Выход администратора выполнен успешно", {
        admin_id: adminId,
        response_time_ms: responseTime,
        sessions_deleted: result.affectedRows,
      });

      return { success: true };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error("Ошибка выхода администратора", {
        error_message: error.message,
        admin_id: adminId,
        response_time_ms: responseTime,
      });
      throw error;
    }
  }

  // Проверка токена
  static async verifyToken(token) {
    const startTime = Date.now();

    // 1. logger.info: полученные данные
    logger.info("Проверка токена администратора - полученные данные", {
      token_length: token?.length,
      token_preview: token ? token.substring(0, 10) + "..." : "нет токена",
    });

    try {
      const tokenSecret = config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO;
      let decoded;

      try {
        decoded = jwt.verify(token, tokenSecret);
      } catch (jwtError) {
        logger.warn("JWT токен недействителен", {
          error: jwtError.message,
          error_type: jwtError.name,
        });
        throw new Error("Недействительный или просроченный токен");
      }

      const session = await query(
        `SELECT s.*, u.username, u.role, u.is_active, u.email, u.full_name
         FROM admin_sessions s
         JOIN admin_users u ON s.admin_id = u.id
         WHERE s.session_token = ? AND s.expires_at > NOW() AND u.is_active = TRUE`,
        [token]
      );

      if (session.length === 0) {
        logger.warn("Сессия администратора не найдена или истекла", {
          admin_id: decoded.adminId,
          username: decoded.username,
        });
        throw new Error("Сессия не найдена или истекла");
      }

      const responseTime = Date.now() - startTime;

      // 2. logger.info: результат операции
      logger.info("Токен администратора проверен успешно", {
        admin_id: session[0].admin_id,
        username: session[0].username,
        role: session[0].role,
        response_time_ms: responseTime,
      });

      return {
        valid: true,
        admin: {
          id: session[0].admin_id,
          username: session[0].username,
          role: session[0].role,
          email: session[0].email,
          fullName: session[0].full_name || session[0].username,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error("Ошибка проверки токена администратора", {
        error_message: error.message,
        response_time_ms: responseTime,
      });
      return { valid: false, error: error.message };
    }
  }
}

module.exports = AdminAuthService;
