const AdminAuthService = require("../services/AdminAuthService");

class AdminAuthController {
  // Вход
  static async login(req, res) {
    console.log("🔐 [AdminAuthController.login] Запрос на вход:", {
      body: { ...req.body, password: req.body.password ? "***" : undefined },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    try {
      const { username, password } = req.body;

      if (!username || !password) {
        console.warn("❌ [AdminAuthController.login] Неполные данные:", {
          hasUsername: !!username,
          hasPassword: !!password,
        });

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

      console.log("✅ [AdminAuthController.login] Успешный вход:", {
        username: result.admin?.username,
        role: result.admin?.role,
        hasToken: !!result.token,
      });

      res.json(result);
    } catch (error) {
      console.error("❌ [AdminAuthController.login] Ошибка входа:", {
        error: error.message,
        stack: error.stack,
        body: { ...req.body, password: req.body.password ? "***" : undefined },
      });

      res.status(401).json({
        success: false,
        message: error.message || "Ошибка аутентификации",
      });
    }
  }

  // Выход
  static async logout(req, res) {
    console.log("🚪 [AdminAuthController.logout] Запрос на выход:", {
      adminId: req.admin?.id,
      username: req.admin?.username,
    });

    try {
      const token = req.headers["authorization"]?.split(" ")[1];

      if (!token) {
        console.warn("⚠️ [AdminAuthController.logout] Токен не предоставлен");
        return res.status(400).json({
          success: false,
          message: "Токен не предоставлен",
        });
      }

      await AdminAuthService.logout(token, req.admin.id);

      console.log("✅ [AdminAuthController.logout] Выход успешен для:", {
        username: req.admin?.username,
        adminId: req.admin?.id,
      });

      res.json({
        success: true,
        message: "Выход выполнен успешно",
      });
    } catch (error) {
      console.error("❌ [AdminAuthController.logout] Ошибка выхода:", {
        error: error.message,
        adminId: req.admin?.id,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка при выходе",
      });
    }
  }

  // Проверка токена
  static async verify(req, res) {
    console.log("🔍 [AdminAuthController.verify] Проверка токена:", {
      headers: {
        authorization: req.headers.authorization ? "Bearer ***" : "Отсутствует",
      },
    });

    try {
      const token = req.headers["authorization"]?.split(" ")[1];

      if (!token) {
        console.warn("⚠️ [AdminAuthController.verify] Токен не предоставлен");
        return res.status(400).json({
          success: false,
          message: "Токен не предоставлен",
        });
      }

      const verification = await AdminAuthService.verifyToken(token);

      if (!verification.valid) {
        console.warn("❌ [AdminAuthController.verify] Токен недействителен:", {
          error: verification.error,
        });

        return res.status(401).json({
          success: false,
          message: "Токен недействителен",
        });
      }

      console.log("✅ [AdminAuthController.verify] Токен валиден для:", {
        username: verification.admin?.username,
        role: verification.admin?.role,
      });

      res.json({
        success: true,
        admin: verification.admin,
      });
    } catch (error) {
      console.error("❌ [AdminAuthController.verify] Ошибка проверки токена:", {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка проверки токена",
      });
    }
  }

  // Получение информации о текущем админе
  static async getProfile(req, res) {
    console.log("👤 [AdminAuthController.getProfile] Запрос профиля:", {
      adminId: req.admin.id,
      username: req.admin.username,
    });

    try {
      console.log("✅ [AdminAuthController.getProfile] Отправка профиля:", {
        username: req.admin.username,
        role: req.admin.role,
      });

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
      console.error(
        "❌ [AdminAuthController.getProfile] Ошибка получения профиля:",
        {
          error: error.message,
          adminId: req.admin?.id,
          stack: error.stack,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения профиля",
      });
    }
  }
}

module.exports = AdminAuthController;
