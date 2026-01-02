const jwt = require("jsonwebtoken");
const { query } = require("../../services/databaseService");
const config = require("../../config");
const logger = require("../../services/LoggerService"); // ← Импортируем логгер

const isAdmin = async (req, res, next) => {
  try {
    // 1. Получаем токен из заголовка
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      logger.warn("Попытка доступа без токена", {
        ip: req.ip,
        endpoint: req.path,
        method: req.method,
        user_agent: req.headers["user-agent"],
      });

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

      logger.debug("JWT токен декодирован", {
        admin_id: decoded.adminId,
        username: decoded.username,
        role: decoded.role,
      });
    } catch (jwtError) {
      logger.warn("Недействительный JWT токен", {
        error: jwtError.message,
        ip: req.ip,
        endpoint: req.path,
        method: req.method,
      });

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
      logger.warn("Попытка доступа неактивного или несуществующего админа", {
        admin_id: decoded.adminId,
        ip: req.ip,
        endpoint: req.path,
      });

      return res.status(403).json({
        success: false,
        message: "Доступ запрещен. Недостаточно прав.",
      });
    }

    // 4. Добавляем информацию об админе в запрос
    req.admin = admin[0];

    // 5. Логируем успешный доступ через логгер
    logger.info("Доступ администратора разрешен", {
      admin_id: req.admin.id,
      username: req.admin.username,
      role: req.admin.role,
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      user_agent: req.headers["user-agent"],
    });

    next();
  } catch (error) {
    logger.error("Ошибка в middleware isAdmin", {
      error_message: error.message,
      error_stack: error.stack?.substring(0, 500),
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      message: "Ошибка проверки прав доступа",
    });
  }
};

module.exports = isAdmin;
