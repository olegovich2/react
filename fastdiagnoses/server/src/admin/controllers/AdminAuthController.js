const AdminAuthService = require("../services/AdminAuthService");
const logger = require("../../services/LoggerService");

class AdminAuthController {
  // Вход
  static async login(req, res) {
    const startTime = Date.now();

    // 1. logger.info: полученные данные
    logger.info("Запрос на вход администратора - полученные данные", {
      username: req.body.username,
      has_password: !!req.body.password,
      ip: req.ip,
      user_agent: req.headers["user-agent"]?.substring(0, 100) || "Неизвестно",
    });

    try {
      const { username, password } = req.body;

      if (!username || !password) {
        logger.warn("Неполные данные для входа администратора", {
          has_username: !!username,
          has_password: !!password,
          ip: req.ip,
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

      const responseTime = Date.now() - startTime;

      // 2. logger.info: отправляемый результат
      logger.info("Отправка результата входа администратора", {
        username: result.admin?.username,
        admin_id: result.admin?.id,
        role: result.admin?.role,
        response_time_ms: responseTime,
        has_token: !!result.token,
        // Можно добавить статус если нужно
      });

      res.json(result);
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error("Ошибка входа администратора", {
        error_message: error.message,
        username: req.body.username,
        response_time_ms: responseTime,
        ip: req.ip,
        endpoint: req.path,
      });

      res.status(401).json({
        success: false,
        message: error.message || "Ошибка аутентификации",
      });
    }
  }

  // Выход
  static async logout(req, res) {
    const startTime = Date.now();

    // 1. logger.info: полученные данные
    logger.info("Запрос на выход администратора - полученные данные", {
      admin_id: req.admin?.id,
      username: req.admin?.username,
      has_auth_header: !!req.headers.authorization,
    });

    try {
      const token = req.headers["authorization"]?.split(" ")[1];

      if (!token) {
        logger.warn("Токен не предоставлен при выходе", {
          admin_id: req.admin?.id,
        });

        return res.status(400).json({
          success: false,
          message: "Токен не предоставлен",
        });
      }

      await AdminAuthService.logout(token, req.admin.id);

      const responseTime = Date.now() - startTime;

      // 2. logger.info: отправляемый результат
      logger.info("Отправка результата выхода администратора", {
        admin_id: req.admin.id,
        username: req.admin.username,
        response_time_ms: responseTime,
        token_preview: token.substring(0, 10) + "...",
      });

      res.json({
        success: true,
        message: "Выход выполнен успешно",
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error("Ошибка выхода администратора", {
        error_message: error.message,
        admin_id: req.admin?.id,
        username: req.admin?.username,
        response_time_ms: responseTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка при выходе",
      });
    }
  }

  // Проверка токена
  static async verify(req, res) {
    const startTime = Date.now();

    // 1. logger.info: полученные данные
    logger.info("Запрос проверки токена - полученные данные", {
      has_auth_header: !!req.headers.authorization,
      ip: req.ip,
    });

    try {
      const token = req.headers["authorization"]?.split(" ")[1];

      if (!token) {
        logger.warn("Токен не предоставлен для проверки", {
          ip: req.ip,
        });

        return res.status(400).json({
          success: false,
          message: "Токен не предоставлен",
        });
      }

      const verification = await AdminAuthService.verifyToken(token);

      if (!verification.valid) {
        const responseTime = Date.now() - startTime;

        logger.warn("Токен администратора недействителен", {
          error: verification.error,
          token_preview: token.substring(0, 10) + "...",
          response_time_ms: responseTime,
        });

        return res.status(401).json({
          success: false,
          message: "Токен недействителен",
        });
      }

      const responseTime = Date.now() - startTime;

      // 2. logger.info: отправляемый результат
      logger.info("Отправка результата проверки токена", {
        admin_id: verification.admin?.id,
        username: verification.admin?.username,
        role: verification.admin?.role,
        response_time_ms: responseTime,
        token_valid: true,
      });

      res.json({
        success: true,
        admin: verification.admin,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error("Ошибка проверки токена администратора", {
        error_message: error.message,
        response_time_ms: responseTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка проверки токена",
      });
    }
  }

  // Получение информации о текущем админе
  static async getProfile(req, res) {
    const startTime = Date.now();

    // 1. logger.info: полученные данные
    logger.info("Запрос профиля администратора - полученные данные", {
      admin_id: req.admin.id,
      username: req.admin.username,
    });

    try {
      const responseTime = Date.now() - startTime;

      // 2. logger.info: отправляемый результат
      logger.info("Отправка профиля администратора", {
        admin_id: req.admin.id,
        username: req.admin.username,
        role: req.admin.role,
        response_time_ms: responseTime,
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
      const responseTime = Date.now() - startTime;

      logger.error("Ошибка получения профиля администратора", {
        error_message: error.message,
        admin_id: req.admin?.id,
        response_time_ms: responseTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения профиля",
      });
    }
  }
}

module.exports = AdminAuthController;
