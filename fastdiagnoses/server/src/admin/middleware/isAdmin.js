const jwt = require("jsonwebtoken");
const { query } = require("../../services/databaseService");
const config = require("../../config");

const isAdmin = async (req, res, next) => {
  try {
    // 1. Получаем токен из заголовка
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Требуется аутентификация",
      });
    }

    // 2. Проверяем JWT токен (отдельный секрет для админов)
    let decoded;
    try {
      decoded = jwt.verify(
        token,
        config.ADMIN_JWT_SECRET || config.JWT_SECRET_TWO
      );
    } catch (jwtError) {
      return res.status(403).json({
        success: false,
        message: "Недействительный или просроченный токен",
      });
    }

    // 3. Проверяем что пользователь - админ
    const admin = await query(
      `SELECT id, username, email, role, is_active 
       FROM admin_users 
       WHERE id = ? AND is_active = TRUE`,
      [decoded.adminId]
    );

    if (admin.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Доступ запрещен. Недостаточно прав.",
      });
    }

    // 4. Добавляем информацию об админе в запрос
    req.admin = admin[0];

    // 5. Логируем доступ (опционально)
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

    next();
  } catch (error) {
    console.error("❌ Ошибка проверки прав админа:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка проверки прав доступа",
    });
  }
};

module.exports = isAdmin;
