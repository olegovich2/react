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

// Очистка старых записей login_attempts (старше 90 дней)
async function cleanupOldLoginAttempts() {
  const operationId = Date.now();
  console.log(`🧹 Начало очистки login_attempts [ID: ${operationId}]`);

  try {
    const startTime = Date.now();

    // Удаляем записи старше 90 дней
    const result = await query(
      "DELETE FROM login_attempts WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
    );

    const deletedCount = result.affectedRows || 0;
    const executionTime = Date.now() - startTime;

    console.log(
      `✅ Очистка login_attempts завершена [ID: ${operationId}]\n` +
        `   📊 Удалено записей: ${deletedCount}\n` +
        `   ⏱️  Время выполнения: ${executionTime}ms\n` +
        `   🕒 Время сервера: ${new Date().toLocaleTimeString()}\n` +
        `   📅 Удалены записи старше: 90 дней`
    );

    return deletedCount;
  } catch (error) {
    console.error(
      `❌ Ошибка очистки login_attempts [ID: ${operationId}]:`,
      error.message
    );
    return 0;
  }
}

// В самом конце файла, перед module.exports, добавляем:

// Обработка очереди отложенного удаления файлов
async function processFileDeletionQueue() {
  const operationId = Date.now();
  console.log(
    `🗑️ Начало обработки очереди удаления файлов [ID: ${operationId}]`
  );

  try {
    // Импортируем динамически, чтобы избежать циклических зависимостей
    const FileDeletionService = require("./FileDeletionService");

    const startTime = Date.now();

    // Обрабатываем очередь
    const result = await FileDeletionService.processDeletionQueue();

    const executionTime = Date.now() - startTime;

    console.log(
      `✅ Обработка очереди удаления завершена [ID: ${operationId}]\n` +
        `   📊 Обработано файлов: ${result.processed || 0}\n` +
        `   ❌ Ошибок: ${result.failed || 0}\n` +
        `   ⏱️  Время выполнения: ${executionTime}ms\n` +
        `   🕒 Время сервера: ${new Date().toLocaleTimeString()}`
    );

    // Получаем статистику для логов
    try {
      const stats = await FileDeletionService.getQueueStats();
      if (stats.success) {
        console.log(
          `   📈 Статистика очереди:\n` +
            `      • Всего записей: ${stats.stats.total || 0}\n` +
            `      • Ожидает обработки: ${stats.stats.pending || 0}\n` +
            `      • В обработке: ${stats.stats.processing || 0}\n` +
            `      • Завершено: ${stats.stats.completed || 0}\n` +
            `      • Ошибок: ${stats.stats.failed || 0}\n` +
            `      • Самое раннее удаление: ${
              stats.stats.earliest_scheduled
                ? new Date(stats.stats.earliest_scheduled).toLocaleString(
                    "ru-RU"
                  )
                : "нет"
            }\n` +
            `      • Самое позднее удаление: ${
              stats.stats.latest_scheduled
                ? new Date(stats.stats.latest_scheduled).toLocaleString("ru-RU")
                : "нет"
            }`
        );
      }
    } catch (statsError) {
      console.log(
        `   ℹ️ Не удалось получить статистику: ${statsError.message}`
      );
    }

    return result;
  } catch (error) {
    console.error(
      `❌ Ошибка обработки очереди удаления [ID: ${operationId}]:`,
      error.message
    );
    return { processed: 0, failed: 0, error: error.message };
  }
}

module.exports = {
  cleanupExpiredSessions,
  cleanupExpiredRegistrations,
  cleanupExpiredResetTokens,
  cleanupOldLoginAttempts,
  processFileDeletionQueue,
};
