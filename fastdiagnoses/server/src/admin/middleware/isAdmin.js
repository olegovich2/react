const jwt = require("jsonwebtoken");
const { query } = require("../../services/databaseService");
const config = require("../../config");

const isAdmin = async (req, res, next) => {
  const startTime = Date.now();

  try {
    console.log("🛡️ [isAdmin] Проверка прав доступа:", {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.substring(0, 100),
    });

    // 1. Получаем токен из заголовка
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    console.log("🔍 [isAdmin] Токен из заголовка:", {
      hasHeader: !!authHeader,
      hasToken: !!token,
      headerPreview: authHeader
        ? authHeader.substring(0, 30) + "..."
        : "Отсутствует",
    });

    if (!token) {
      console.warn("⚠️ [isAdmin] Токен не предоставлен");
      return res.status(401).json({
        success: false,
        message: "Требуется аутентификация",
      });
    }

    // 2. Проверяем JWT токен
    let decoded;
    try {
      const tokenSecret = config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO;
      console.log("🔍 [isAdmin] Проверка JWT:", {
        secretExists: !!tokenSecret,
        tokenPreview: token.substring(0, 20) + "...",
      });

      decoded = jwt.verify(token, tokenSecret);

      console.log("✅ [isAdmin] JWT декодирован:", {
        adminId: decoded.adminId,
        username: decoded.username,
        role: decoded.role,
        exp: decoded.exp,
        iat: decoded.iat,
      });
    } catch (jwtError) {
      console.error("❌ [isAdmin] Ошибка JWT:", {
        error: jwtError.message,
        name: jwtError.name,
        tokenPreview: token.substring(0, 20) + "...",
      });

      return res.status(403).json({
        success: false,
        message: "Недействительный или просроченный токен",
      });
    }

    // 3. Проверяем что пользователь - админ
    console.log("🔍 [isAdmin] Поиск админа в БД:", {
      adminId: decoded.adminId,
    });

    const admin = await query(
      `SELECT id, username, email, role, is_active, full_name, last_login, created_at
       FROM admin_users 
       WHERE id = ? AND is_active = TRUE`,
      [decoded.adminId]
    );

    console.log("🔍 [isAdmin] Результат поиска админа:", {
      found: admin.length > 0,
      username: admin[0]?.username,
      role: admin[0]?.role,
      is_active: admin[0]?.is_active,
    });

    if (admin.length === 0) {
      console.warn("⛔ [isAdmin] Админ не найден или не активен:", {
        adminId: decoded.adminId,
        decodedUsername: decoded.username,
      });

      return res.status(403).json({
        success: false,
        message: "Доступ запрещен. Недостаточно прав.",
      });
    }

    // 4. Добавляем информацию об админе в запрос
    req.admin = admin[0];

    console.log("✅ [isAdmin] Админ найден:", {
      id: req.admin.id,
      username: req.admin.username,
      role: req.admin.role,
    });

    // 4.1 Логируем успешный вход админа в login_attempts
    try {
      await query(
        `INSERT INTO login_attempts (login, ip_address, success, user_agent, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [
          req.admin.username,
          req.ip || req.connection.remoteAddress,
          1, // успешный вход
          req.headers["user-agent"] || "Неизвестно",
        ]
      );
      console.log("📝 [isAdmin] Логирование входа админа в login_attempts");
    } catch (loginLogError) {
      console.error(
        "⚠️ [isAdmin] Ошибка логирования входа админа:",
        loginLogError.message
      );
      // Не прерываем выполнение, если не удалось залогировать
    }

    // 5. Логируем доступ
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
      console.log("📝 [isAdmin] Логирование доступа завершено");
    } catch (logError) {
      console.error(
        "⚠️ [isAdmin] Ошибка логирования доступа:",
        logError.message
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [isAdmin] Проверка прав завершена за ${totalTime}ms`);

    next();
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [isAdmin] Ошибка проверки прав за ${totalTime}ms:`, {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      message: "Ошибка проверки прав доступа",
    });
  }
};

module.exports = isAdmin;
