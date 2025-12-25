const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../../services/databaseService");
const config = require("../../config");

class AdminAuthService {
  // Вход администратора
  static async login(username, password, ip, userAgent) {
    try {
      console.log("🔍 [AdminAuthService.login] Начало входа для:", username);
      console.log("🔍 [AdminAuthService.login] IP:", ip);

      // 1. Найти администратора
      const admin = await query(
        `SELECT id, username, password_hash, email, role, is_active, 
                login_attempts, locked_until 
         FROM admin_users 
         WHERE username = ?`,
        [username]
      );

      console.log(
        "🔍 [AdminAuthService.login] Найден админ:",
        admin.length > 0
      );

      if (admin.length === 0) {
        console.log("❌ [AdminAuthService.login] Админ не найден в БД");

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

      console.log("🔍 [AdminAuthService.login] Данные админа:", {
        id: adminData.id,
        username: adminData.username,
        email: adminData.email,
        role: adminData.role,
        is_active: adminData.is_active,
        login_attempts: adminData.login_attempts,
        locked_until: adminData.locked_until,
        password_hash_length: adminData.password_hash?.length,
        password_hash_prefix: adminData.password_hash?.substring(0, 30),
      });

      // 2. Проверка блокировки
      if (adminData.locked_until && adminData.locked_until > new Date()) {
        console.log(
          "❌ [AdminAuthService.login] Аккаунт заблокирован до:",
          adminData.locked_until
        );
        throw new Error("Аккаунт временно заблокирован");
      }

      // 3. Проверка пароля
      console.log("🔍 [AdminAuthService.login] Проверяю пароль...");
      console.log(
        "🔍 [AdminAuthService.login] Введенный пароль:",
        `"${password}"`
      );
      console.log(
        "🔍 [AdminAuthService.login] Хеш в БД:",
        adminData.password_hash
      );
      console.log(
        "🔍 [AdminAuthService.login] Длина хеша:",
        adminData.password_hash?.length
      );

      // Проверяем формат хеша
      if (
        !adminData.password_hash.startsWith("$2a$") &&
        !adminData.password_hash.startsWith("$2b$") &&
        !adminData.password_hash.startsWith("$2y$")
      ) {
        console.log(
          "⚠️ [AdminAuthService.login] Хеш не в формате bcrypt! Начинается с:",
          adminData.password_hash.substring(0, 10)
        );
      }

      if (adminData.password_hash.length !== 60) {
        console.log(
          "⚠️ [AdminAuthService.login] Длина хеша некорректная! Ожидается 60, получено:",
          adminData.password_hash.length
        );
      }

      const validPassword = await bcrypt.compare(
        password,
        adminData.password_hash
      );

      console.log(
        "🔍 [AdminAuthService.login] Результат bcrypt.compare:",
        validPassword
      );

      if (!validPassword) {
        console.log("❌ [AdminAuthService.login] Пароль не совпал");

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
            JSON.stringify({
              reason: "invalid_password",
              hash_length: adminData.password_hash?.length,
            }),
            ip,
            userAgent,
          ]
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Неверные учетные данные");
      }

      console.log("✅ [AdminAuthService.login] Пароль совпал!");

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
      console.log(
        "🔍 [AdminAuthService.login] Секрет для JWT:",
        tokenSecret ? "Есть" : "Отсутствует"
      );

      const token = jwt.sign(
        {
          adminId: adminData.id,
          username: adminData.username,
          role: adminData.role,
        },
        tokenSecret,
        { expiresIn: "8h" }
      );

      console.log("🔍 [AdminAuthService.login] Сгенерирован JWT токен");

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
          JSON.stringify({ method: "password", token_length: token.length }),
          ip,
          userAgent,
        ]
      );

      console.log(
        "✅ [AdminAuthService.login] Вход успешен для:",
        adminData.username
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
      console.error(
        "❌ [AdminAuthService.login] Ошибка входа администратора:",
        error.message
      );
      console.error("❌ [AdminAuthService.login] Stack trace:", error.stack);
      throw error;
    }
  }

  // Выход
  static async logout(token, adminId) {
    try {
      console.log("🔍 [AdminAuthService.logout] Выход для adminId:", adminId);

      await query("DELETE FROM admin_sessions WHERE session_token = ?", [
        token,
      ]);

      await query(
        `INSERT INTO admin_logs (admin_id, action_type) 
         VALUES (?, ?)`,
        [adminId, "logout"]
      );

      console.log("✅ [AdminAuthService.logout] Выход успешен");

      return { success: true };
    } catch (error) {
      console.error(
        "❌ [AdminAuthService.logout] Ошибка выхода администратора:",
        error
      );
      throw error;
    }
  }

  // Проверка токена
  static async verifyToken(token) {
    try {
      console.log("🔍 [AdminAuthService.verifyToken] Проверка токена");

      const tokenSecret = config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO;
      console.log(
        "🔍 [AdminAuthService.verifyToken] Секрет для проверки:",
        tokenSecret ? "Есть" : "Отсутствует"
      );

      const decoded = jwt.verify(token, tokenSecret);

      console.log(
        "🔍 [AdminAuthService.verifyToken] Декодированный токен:",
        decoded
      );

      const session = await query(
        `SELECT s.*, u.username, u.role, u.is_active 
         FROM admin_sessions s
         JOIN admin_users u ON s.admin_id = u.id
         WHERE s.session_token = ? AND s.expires_at > NOW() AND u.is_active = TRUE`,
        [token]
      );

      console.log(
        "🔍 [AdminAuthService.verifyToken] Найдено сессий:",
        session.length
      );

      if (session.length === 0) {
        console.log(
          "❌ [AdminAuthService.verifyToken] Сессия не найдена или истекла"
        );
        throw new Error("Сессия не найдена или истекла");
      }

      console.log(
        "✅ [AdminAuthService.verifyToken] Токен валиден для:",
        session[0].username
      );

      return {
        valid: true,
        admin: {
          id: session[0].admin_id,
          username: session[0].username,
          role: session[0].role,
        },
      };
    } catch (error) {
      console.error(
        "❌ [AdminAuthService.verifyToken] Ошибка проверки токена:",
        error.message
      );
      return { valid: false, error: error.message };
    }
  }
}

module.exports = AdminAuthService;
