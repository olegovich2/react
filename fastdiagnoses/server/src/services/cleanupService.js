const { query } = require("./databaseService"); // Предполагаем, что создадим этот сервис
const jwt = require("jsonwebtoken");
const config = require("../config");

// Очистка истекших сессий
async function cleanupExpiredSessions() {
  try {
    const startTime = Date.now();
    let deletedCount = 0;

    // Проверяем сессии по JWT
    const sessions = await query(
      "SELECT id, login, jwt_access FROM sessionsdata"
    );

    for (const session of sessions) {
      try {
        jwt.verify(session.jwt_access, config.JWT_SECRET_TWO);
      } catch (tokenError) {
        await query("DELETE FROM sessionsdata WHERE id = ?", [session.id]);
        deletedCount++;
      }
    }

    // Удаляем сессии старше 2 часов
    const twoHoursAgo = new Date(Date.now() - config.MAX_SESSION_AGE);
    const result = await query("DELETE FROM sessionsdata WHERE date < ?", [
      twoHoursAgo,
    ]);

    deletedCount += result.affectedRows || 0;

    console.log(
      `✅ Очистка сессий завершена за ${
        Date.now() - startTime
      }ms. Удалено: ${deletedCount}`
    );
    return deletedCount;
  } catch (error) {
    console.error("❌ Ошибка при очистке сессий:", error);
    return 0;
  }
}

// Очистка неактивированных аккаунтов
async function cleanupExpiredRegistrations() {
  try {
    const startTime = Date.now();
    const users = await query(
      "SELECT login, email, jwt FROM usersdata WHERE logic = 'false'"
    );

    let deletedCount = 0;

    for (const user of users) {
      try {
        jwt.verify(user.jwt, config.JWT_SECRET);
      } catch (tokenError) {
        await query(
          "DELETE FROM usersdata WHERE login = ? AND logic = 'false'",
          [user.login]
        );
        deletedCount++;
      }
    }

    console.log(
      `✅ Очистка аккаунтов завершена за ${
        Date.now() - startTime
      }ms. Удалено: ${deletedCount}`
    );
    return deletedCount;
  } catch (error) {
    console.error("❌ Ошибка при очистке неактивированных аккаунтов:", error);
    return 0;
  }
}

// Очистка устаревших токенов восстановления
async function cleanupExpiredResetTokens() {
  const operationId = Date.now(); // Уникальный ID операции для логов
  console.log(`🧹 Начало очистки токенов восстановления [ID: ${operationId}]`);

  try {
    const startTime = Date.now();
    const result = await query(
      "DELETE FROM password_resets WHERE expires_at < NOW() OR used = TRUE"
    );

    const deletedCount = result.affectedRows || 0;
    const executionTime = Date.now() - startTime;

    console.log(
      `✅ Очистка токенов завершена [ID: ${operationId}]\n` +
        `   📊 Удалено записей: ${deletedCount}\n` +
        `   ⏱️  Время выполнения: ${executionTime}ms\n` +
        `   🕒 Время сервера: ${new Date().toLocaleTimeString()}`
    );

    return deletedCount;
  } catch (error) {
    console.error(
      `❌ Ошибка очистки токенов [ID: ${operationId}]:`,
      error.message
    );
    return 0;
  }
}

module.exports = {
  cleanupExpiredSessions,
  cleanupExpiredRegistrations,
  cleanupExpiredResetTokens,
};
