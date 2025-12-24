const jwt = require("jsonwebtoken");
const config = require("../config");
const { query } = require("../services/databaseService");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Токен отсутствует или имеет неверный формат",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.JWT_SECRET_TWO);

    const session = await query(
      "SELECT * FROM sessionsdata WHERE jwt_access = ? AND login = ?",
      [token, decoded.login]
    );

    if (session.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Сессия не найдена или устарела",
      });
    }

    const sessionAge = Date.now() - new Date(session[0].date).getTime();
    const MAX_SESSION_AGE = config.MAX_SESSION_AGE;

    if (sessionAge > MAX_SESSION_AGE) {
      await query("DELETE FROM sessionsdata WHERE jwt_access = ?", [token]);
      return res.status(401).json({
        success: false,
        message: "Сессия истекла",
      });
    }

    req.user = {
      login: decoded.login,
      token,
      sessionId: session[0].id,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Неверный токен",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Токен истек",
      });
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка аутентификации",
    });
  }
};

module.exports = {
  authenticateToken,
};
