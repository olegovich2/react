const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../../services/databaseService");
const config = require("../../config");

class AdminAuthService {
  // Вход администратора
  static async login(username, password, ip, userAgent) {
    try {
      // 1. Найти администратора
      const admin = await query(
        `SELECT id, username, password_hash, email, role, is_active, 
                login_attempts, locked_until 
         FROM admin_users 
         WHERE username = ?`,
        [username]
      );

      if (admin.length === 0) {
        // Логируем попытку входа несуществующего пользователя
        await query(
          `INSERT INTO admin_logs (admin_id, action_type, details, ip_address, user_agent) 
           VALUES (?, ?, ?, ?, ?)`,
          [0, "failed_login", JSON.stringify({ username }), ip, userAgent]
        );

        await new Promise((resolve) => setTimeout(resolve, 1000)); // Задержка против брутфорса

        throw new Error("Неверные учетные данные");
      }

      const adminData = admin[0];

      // 2. Проверка блокировки
      if (adminData.locked_until && adminData.locked_until > new Date()) {
        throw new Error("Аккаунт временно заблокирован");
      }

      // 3. Проверка пароля
      const validPassword = await bcrypt.compare(
        password,
        adminData.password_hash
      );

      if (!validPassword) {
        // Увеличиваем счетчик неудачных попыток
        await query(
          `UPDATE admin_users 
           SET login_attempts = login_attempts + 1,
               locked_until = CASE 
                 WHEN login_attempts >= 4 THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
                 ELSE locked_until 
               END
           WHERE id = ?`,
          [adminData.id]
        );

        // Логируем неудачную попытку
        await query(
          `INSERT INTO admin_logs (admin_id, action_type, details, ip_address, user_agent) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            adminData.id,
            "failed_login",
            JSON.stringify({ reason: "invalid_password" }),
            ip,
            userAgent,
          ]
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
      const token = jwt.sign(
        {
          adminId: adminData.id,
          username: adminData.username,
          role: adminData.role,
        },
        config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO,
        { expiresIn: "8h" }
      );

      // 6. Сохраняем сессию
      await query(
        `INSERT INTO admin_sessions (admin_id, session_token, ip_address, user_agent, expires_at) 
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR))`,
        [adminData.id, token, ip, userAgent]
      );

      // 7. Очищаем старые сессии (оставляем последние 5)
      await query(
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
      await query(
        `INSERT INTO admin_logs (admin_id, action_type, details, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          adminData.id,
          "login",
          JSON.stringify({ method: "password" }),
          ip,
          userAgent,
        ]
      );

      return {
        success: true,
        token,
        admin: {
          id: adminData.id,
          username: adminData.username,
          email: adminData.email,
          role: adminData.role,
          fullName: adminData.full_name,
        },
      };
    } catch (error) {
      console.error("❌ Ошибка входа администратора:", error);
      throw error;
    }
  }

  // Выход
  static async logout(token, adminId) {
    try {
      await query("DELETE FROM admin_sessions WHERE session_token = ?", [
        token,
      ]);

      await query(
        `INSERT INTO admin_logs (admin_id, action_type) 
         VALUES (?, ?)`,
        [adminId, "logout"]
      );

      return { success: true };
    } catch (error) {
      console.error("❌ Ошибка выхода администратора:", error);
      throw error;
    }
  }

  // Проверка токена
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(
        token,
        config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO
      );

      const session = await query(
        `SELECT s.*, u.username, u.role, u.is_active 
         FROM admin_sessions s
         JOIN admin_users u ON s.admin_id = u.id
         WHERE s.session_token = ? AND s.expires_at > NOW() AND u.is_active = TRUE`,
        [token]
      );

      if (session.length === 0) {
        throw new Error("Сессия не найдена или истекла");
      }

      return {
        valid: true,
        admin: {
          id: session[0].admin_id,
          username: session[0].username,
          role: session[0].role,
        },
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = AdminAuthService;
