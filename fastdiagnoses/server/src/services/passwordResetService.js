const crypto = require("crypto");
const { query } = require("./databaseService");

class PasswordResetService {
  async createToken(email) {
    try {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);

      await query("DELETE FROM password_resets WHERE email = ?", [email]);

      await query(
        "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)",
        [email, token, expiresAt]
      );

      console.log(`✅ Токен восстановления создан для ${email}`);
      return token;
    } catch (error) {
      console.error("❌ Ошибка создания токена восстановления:", error);
      throw error;
    }
  }

  async validateToken(token) {
    try {
      const results = await query(
        "SELECT id, email, expires_at FROM password_resets WHERE token = ? AND used = FALSE AND expires_at > NOW()",
        [token]
      );

      if (results.length === 0) {
        return {
          valid: false,
          message: "Токен недействителен, использован или устарел",
        };
      }

      const resetRecord = results[0];

      return {
        valid: true,
        email: resetRecord.email,
        resetId: resetRecord.id,
        expiresAt: resetRecord.expires_at,
      };
    } catch (error) {
      console.error("❌ Ошибка проверки токена восстановления:", error);
      return { valid: false, message: "Ошибка проверки токена" };
    }
  }

  async markAsUsed(tokenId) {
    try {
      await query("UPDATE password_resets SET used = TRUE WHERE id = ?", [
        tokenId,
      ]);
      console.log(`✅ Токен ${tokenId} помечен как использованный`);
    } catch (error) {
      console.error("❌ Ошибка пометки токена как использованного:", error);
      throw error;
    }
  }

  async cleanupExpiredTokens() {
    try {
      const startTime = Date.now();
      const result = await query(
        "DELETE FROM password_resets WHERE expires_at < NOW() OR used = TRUE"
      );

      const deletedCount = result.affectedRows || 0;
      const executionTime = Date.now() - startTime;

      console.log(
        `✅ Очистка токенов восстановления завершена за ${executionTime}ms. ` +
          `Удалено: ${deletedCount}`
      );

      return deletedCount;
    } catch (error) {
      console.error("❌ Ошибка очистки токенов восстановления:", error);
      return 0;
    }
  }
}

module.exports = new PasswordResetService();
