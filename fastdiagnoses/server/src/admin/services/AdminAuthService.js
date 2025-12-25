const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../../services/databaseService");
const config = require("../../config");

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
      await query(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          adminId,
          actionType,
          targetType,
          targetId,
          JSON.stringify(details),
          ip,
          userAgent || "Неизвестно",
        ]
      );
      console.log(
        `📝 [AdminLog] ${actionType} для admin ${adminId}: ${JSON.stringify(
          details
        )}`
      );
    } catch (error) {
      console.error("❌ [AdminLog] Ошибка логирования:", error.message);
    }
  }

  // Вход администратора
  static async login(username, password, ip, userAgent) {
    const startTime = Date.now();

    try {
      console.log("🔍 [AdminAuthService.login] Начало входа:", {
        username,
        ip,
        userAgent: userAgent?.substring(0, 100) || "Неизвестно",
      });

      // 1. Найти администратора
      const admin = await query(
        `SELECT id, username, password_hash, email, role, is_active, 
                login_attempts, locked_until, full_name
         FROM admin_users 
         WHERE username = ?`,
        [username]
      );

      console.log(
        "🔍 [AdminAuthService.login] Найден админ в БД:",
        admin.length > 0
      );

      if (admin.length === 0) {
        console.warn("❌ [AdminAuthService.login] Админ не найден:", username);

        try {
          await query(
            `INSERT INTO login_attempts (login, ip_address, success, user_agent) 
       VALUES (?, ?, ?, ?)`,
            [username, ip, 0, userAgent || "Неизвестно"]
          );
          console.log(
            "📝 [AdminAuthService.login] Запись неудачной попытки (не найден) в login_attempts"
          );
        } catch (loginLogError) {
          console.error(
            "⚠️ [AdminAuthService.login] Ошибка логирования в login_attempts:",
            loginLogError.message
          );
        }

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

      console.log("🔍 [AdminAuthService.login] Данные админа:", {
        id: adminData.id,
        username: adminData.username,
        email: adminData.email,
        role: adminData.role,
        is_active: adminData.is_active,
        login_attempts: adminData.login_attempts,
        locked_until: adminData.locked_until,
        has_password_hash: !!adminData.password_hash,
        password_hash_length: adminData.password_hash?.length,
      });

      // 2. Проверка блокировки
      if (adminData.locked_until && adminData.locked_until > new Date()) {
        console.warn(
          "⛔ [AdminAuthService.login] Аккаунт заблокирован до:",
          adminData.locked_until
        );

        try {
          await query(
            `INSERT INTO login_attempts (login, ip_address, success, user_agent) 
       VALUES (?, ?, ?, ?)`,
            [username, ip, 0, userAgent || "Неизвестно"]
          );
          console.log(
            "📝 [AdminAuthService.login] Запись неудачной попытки (заблокирован) в login_attempts"
          );
        } catch (loginLogError) {
          console.error(
            "⚠️ [AdminAuthService.login] Ошибка логирования в login_attempts:",
            loginLogError.message
          );
        }

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
      console.log("🔍 [AdminAuthService.login] Проверка пароля...");

      const validPassword = await bcrypt.compare(
        password,
        adminData.password_hash
      );

      console.log(
        "🔍 [AdminAuthService.login] Результат проверки пароля:",
        validPassword
      );

      if (!validPassword) {
        console.warn(
          "❌ [AdminAuthService.login] Неверный пароль для:",
          username
        );

        try {
          await query(
            `INSERT INTO login_attempts (login, ip_address, success, user_agent) 
       VALUES (?, ?, ?, ?)`,
            [username, ip, 0, userAgent || "Неизвестно"]
          );
          console.log(
            "📝 [AdminAuthService.login] Запись неудачной попытки (неверный пароль) в login_attempts"
          );
        } catch (loginLogError) {
          console.error(
            "⚠️ [AdminAuthService.login] Ошибка логирования в login_attempts:",
            loginLogError.message
          );
        }

        // Увеличиваем счетчик неудачных попыток
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

      console.log("✅ [AdminAuthService.login] Пароль верный!");

      // 4. Сброс счетчика неудачных попыток
      await query(
        `UPDATE admin_users 
         SET login_attempts = 0, 
             locked_until = NULL,
             last_login = NOW()
         WHERE id = ?`,
        [adminData.id]
      );

      console.log("✅ [AdminAuthService.login] Счетчик попыток сброшен");

      // 5. Генерация JWT токена
      const tokenSecret = config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO;

      console.log("🔍 [AdminAuthService.login] Генерация JWT:", {
        secretExists: !!tokenSecret,
        adminId: adminData.id,
        username: adminData.username,
      });

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

      console.log("✅ [AdminAuthService.login] JWT сгенерирован:", {
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + "...",
      });

      // 6. Сохраняем сессию
      await query(
        `INSERT INTO admin_sessions (admin_id, session_token, ip_address, user_agent, expires_at) 
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR))`,
        [adminData.id, token, ip, userAgent]
      );

      console.log("✅ [AdminAuthService.login] Сессия сохранена в БД");

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

      console.log(
        "🧹 [AdminAuthService.login] Очищено старых сессий:",
        cleanupResult.affectedRows
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
        },
        ip,
        userAgent
      );

      const totalTime = Date.now() - startTime;

      console.log(
        `✅ [AdminAuthService.login] Вход успешен за ${totalTime}ms:`,
        {
          username: adminData.username,
          role: adminData.role,
          email: adminData.email,
        }
      );

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
      console.error(
        `❌ [AdminAuthService.login] Ошибка входа за ${totalTime}ms:`,
        {
          error: error.message,
          username,
          stack: error.stack,
        }
      );
      throw error;
    }
  }

  // Выход
  static async logout(token, adminId) {
    try {
      console.log("🚪 [AdminAuthService.logout] Начало выхода:", {
        adminId,
        tokenPreview: token?.substring(0, 20) + "...",
      });

      const result = await query(
        "DELETE FROM admin_sessions WHERE session_token = ?",
        [token]
      );

      console.log(
        "✅ [AdminAuthService.logout] Сессия удалена из БД:",
        result.affectedRows
      );

      await this.logAdminAction(
        adminId,
        "logout",
        "auth",
        null,
        { token_preview: token?.substring(0, 20) + "..." },
        null,
        null
      );

      console.log(
        "✅ [AdminAuthService.logout] Выход успешен для admin:",
        adminId
      );

      return { success: true };
    } catch (error) {
      console.error("❌ [AdminAuthService.logout] Ошибка выхода:", {
        error: error.message,
        adminId,
        stack: error.stack,
      });
      throw error;
    }
  }

  // Проверка токена
  static async verifyToken(token) {
    try {
      console.log("🔍 [AdminAuthService.verifyToken] Проверка токена:", {
        tokenLength: token?.length,
        tokenPreview: token?.substring(0, 20) + "...",
      });

      const tokenSecret = config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO;

      console.log("🔍 [AdminAuthService.verifyToken] Секрет для проверки:", {
        hasSecret: !!tokenSecret,
        secretLength: tokenSecret?.length,
      });

      let decoded;
      try {
        decoded = jwt.verify(token, tokenSecret);
        console.log("✅ [AdminAuthService.verifyToken] JWT декодирован:", {
          adminId: decoded.adminId,
          username: decoded.username,
          role: decoded.role,
          exp: decoded.exp,
          iat: decoded.iat,
        });
      } catch (jwtError) {
        console.error("❌ [AdminAuthService.verifyToken] Ошибка JWT:", {
          error: jwtError.message,
          name: jwtError.name,
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

      console.log("🔍 [AdminAuthService.verifyToken] Сессия в БД:", {
        found: session.length > 0,
        expiresAt: session[0]?.expires_at,
        isActive: session[0]?.is_active,
      });

      if (session.length === 0) {
        console.warn(
          "⚠️ [AdminAuthService.verifyToken] Сессия не найдена или истекла"
        );
        throw new Error("Сессия не найдена или истекла");
      }

      console.log("✅ [AdminAuthService.verifyToken] Токен валиден для:", {
        username: session[0].username,
        role: session[0].role,
        email: session[0].email,
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
      console.error(
        "❌ [AdminAuthService.verifyToken] Ошибка проверки токена:",
        {
          error: error.message,
          stack: error.stack,
        }
      );
      return { valid: false, error: error.message };
    }
  }
}

module.exports = AdminAuthService;
