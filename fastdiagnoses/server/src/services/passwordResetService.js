const crypto = require("crypto");
const { query } = require("./databaseService");
const logger = require("../services/LoggerService");

class PasswordResetService {
  async createToken(email) {
    const startTime = Date.now();

    try {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);

      await query("DELETE FROM password_resets WHERE email = ?", [email]);

      await query(
        "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)",
        [email, token, expiresAt]
      );

      const executionTime = Date.now() - startTime;

      logger.warn("Токен восстановления создан", {
        type: "password_reset",
        action: "create_token",
        email: email,
        status: "success",
        execution_time_ms: executionTime,
        expires_at: expiresAt.toISOString(),
        timestamp: new Date().toISOString(),
      });

      return token;
    } catch (error) {
      logger.error("Ошибка создания токена восстановления", {
        type: "password_reset",
        action: "create_token",
        email: email,
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async validateToken(token) {
    const startTime = Date.now();

    try {
      const results = await query(
        "SELECT id, email, expires_at FROM password_resets WHERE token = ? AND used = FALSE AND expires_at > NOW()",
        [token]
      );

      const executionTime = Date.now() - startTime;

      if (results.length === 0) {
        logger.warn("Токен восстановления недействителен", {
          type: "password_reset",
          action: "validate_token",
          status: "invalid",
          execution_time_ms: executionTime,
          reason: "Токен недействителен, использован или устарел",
          timestamp: new Date().toISOString(),
        });

        return {
          valid: false,
          message: "Токен недействителен, использован или устарел",
        };
      }

      const resetRecord = results[0];

      logger.info("Токен восстановления проверен", {
        type: "password_reset",
        action: "validate_token",
        status: "valid",
        email: resetRecord.email,
        reset_id: resetRecord.id,
        execution_time_ms: executionTime,
        expires_at: resetRecord.expires_at,
        timestamp: new Date().toISOString(),
      });

      return {
        valid: true,
        email: resetRecord.email,
        resetId: resetRecord.id,
        expiresAt: resetRecord.expires_at,
      };
    } catch (error) {
      logger.error("Ошибка проверки токена восстановления", {
        type: "password_reset",
        action: "validate_token",
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      return { valid: false, message: "Ошибка проверки токена" };
    }
  }

  async markAsUsed(tokenId) {
    const startTime = Date.now();

    try {
      await query("UPDATE password_resets SET used = TRUE WHERE id = ?", [
        tokenId,
      ]);

      const executionTime = Date.now() - startTime;

      logger.warn("Токен помечен как использованный", {
        type: "password_reset",
        action: "mark_used",
        reset_id: tokenId,
        status: "success",
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Ошибка пометки токена как использованного", {
        type: "password_reset",
        action: "mark_used",
        reset_id: tokenId,
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async cleanupExpiredTokens() {
    const startTime = Date.now();

    try {
      const result = await query(
        "DELETE FROM password_resets WHERE expires_at < NOW() OR used = TRUE"
      );

      const deletedCount = result.affectedRows || 0;
      const executionTime = Date.now() - startTime;

      logger.warn("Очистка токенов восстановления завершена", {
        type: "password_reset",
        action: "cleanup_tokens",
        status: "success",
        execution_time_ms: executionTime,
        records_deleted: deletedCount,
        timestamp: new Date().toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logger.error("Ошибка очистки токенов восстановления", {
        type: "password_reset",
        action: "cleanup_tokens",
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      return 0;
    }
  }
}

module.exports = new PasswordResetService();
