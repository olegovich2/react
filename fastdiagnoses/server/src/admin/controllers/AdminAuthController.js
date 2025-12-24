const AdminAuthService = require("../services/AdminAuthService");

class AdminAuthController {
  // Вход
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Имя пользователя и пароль обязательны",
        });
      }

      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "Неизвестное устройство";

      const result = await AdminAuthService.login(
        username,
        password,
        ip,
        userAgent
      );

      res.json(result);
    } catch (error) {
      console.error("❌ Ошибка входа админа:", error);

      res.status(401).json({
        success: false,
        message: error.message || "Ошибка аутентификации",
      });
    }
  }

  // Выход
  static async logout(req, res) {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Токен не предоставлен",
        });
      }

      await AdminAuthService.logout(token, req.admin.id);

      res.json({
        success: true,
        message: "Выход выполнен успешно",
      });
    } catch (error) {
      console.error("❌ Ошибка выхода админа:", error);

      res.status(500).json({
        success: false,
        message: "Ошибка при выходе",
      });
    }
  }

  // Проверка токена
  static async verify(req, res) {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Токен не предоставлен",
        });
      }

      const verification = await AdminAuthService.verifyToken(token);

      if (!verification.valid) {
        return res.status(401).json({
          success: false,
          message: "Токен недействителен",
        });
      }

      res.json({
        success: true,
        admin: verification.admin,
      });
    } catch (error) {
      console.error("❌ Ошибка проверки токена админа:", error);

      res.status(500).json({
        success: false,
        message: "Ошибка проверки токена",
      });
    }
  }

  // Получение информации о текущем админе
  static async getProfile(req, res) {
    try {
      res.json({
        success: true,
        admin: {
          id: req.admin.id,
          username: req.admin.username,
          email: req.admin.email,
          fullName: req.admin.full_name,
          role: req.admin.role,
          lastLogin: req.admin.last_login,
          createdAt: req.admin.created_at,
        },
      });
    } catch (error) {
      console.error("❌ Ошибка получения профиля админа:", error);

      res.status(500).json({
        success: false,
        message: "Ошибка получения профиля",
      });
    }
  }
}

module.exports = AdminAuthController;
