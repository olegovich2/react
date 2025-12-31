// src/routes/user/userRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Импорты
const { authenticateToken } = require("../../middleware/auth");
const { query, getConnection } = require("../../services/databaseService");
const { validatePassword } = require("../../utils/validators");
const emailService = require("../../utils/emailService");
const config = require("../../config");

// ИМПОРТ fs - ВАЖНО! Добавлены все необходимые импорты
const fs = require("fs").promises;
const path = require("path");

// Получение информации о пользователе
router.get("/user-info", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;

    const userInfo = await query(
      "SELECT login, email FROM usersdata WHERE login = ? AND logic = 'true'",
      [login]
    );

    if (userInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    res.json({
      success: true,
      user: {
        login: userInfo[0].login,
        email: userInfo[0].email,
      },
    });
  } catch (error) {
    console.error("Ошибка получения информации пользователя:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка получения информации",
    });
  }
});

// Смена пароля с кодовым словом
router.post("/change-password", authenticateToken, async (req, res) => {
  console.log("🔐 Запрос смены пароля с проверкой кодового слова");

  try {
    const { currentPassword, newPassword, secretWord } = req.body;
    console.log(
      "🔐 Secret word из запроса:",
      secretWord ? "присутствует" : "отсутствует"
    );

    const login = req.user.login;
    console.log("👤 Пользователь:", login);

    // 1. Базовая валидация
    if (!currentPassword || !newPassword || !secretWord) {
      return res.status(400).json({
        success: false,
        message: !currentPassword
          ? "Введите текущий пароль"
          : !newPassword
          ? "Введите новый пароль"
          : "Введите кодовое слово",
        field: !currentPassword
          ? "currentPassword"
          : !newPassword
          ? "newPassword"
          : "secretWord",
      });
    }

    if (typeof secretWord !== "string") {
      return res.status(400).json({
        success: false,
        message: "Кодовое слово должно быть текстом",
        field: "secretWord",
      });
    }

    const trimmedSecretWord = secretWord.trim();
    if (trimmedSecretWord === "") {
      return res.status(400).json({
        success: false,
        message: "Введите кодовое слово",
        field: "secretWord",
      });
    }

    // 2. Проверка сложности нового пароля
    try {
      validatePassword(newPassword);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
        field: "newPassword",
      });
    }

    // 3. Задержка для предотвращения timing-атак
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Получаем данные пользователя
    console.log(`🔍 Поиск пользователя: ${login}`);
    const user = await query(
      "SELECT login, email, password, secret_word, blocked FROM usersdata WHERE login = ? AND logic = 'true'",
      [login]
    );

    if (!user || user.length === 0) {
      console.log(`❌ Пользователь не найден: ${login}`);
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    const userData = user[0];
    const userEmail = userData.email;
    console.log("✅ Пользователь найден:", {
      login: userData.login,
      email: userEmail,
      hasSecretWord: !!userData.secret_word,
      blocked: userData.blocked,
    });

    // 5. Проверяем, не заблокирован ли пользователь
    if (userData.blocked === 1) {
      console.log(`⛔ Заблокированный пользователь: ${login}`);
      return res.status(403).json({
        success: false,
        message: "Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 6. Получаем количество существующих попыток смены пароля по EMAIL
    let attemptCount = 0;
    let attemptsRecordId = null;

    try {
      const attemptsResult = await query(
        "SELECT id, attempts FROM password_reset_attempts WHERE email = ?",
        [userEmail]
      );

      if (attemptsResult && attemptsResult.length > 0) {
        attemptCount = attemptsResult[0].attempts || 0;
        attemptsRecordId = attemptsResult[0].id;
      }

      console.log(
        `📊 Существующие попытки смены пароля для ${userEmail}: ${attemptCount}`
      );
    } catch (attemptsError) {
      console.error("❌ Ошибка получения попыток:", attemptsError.message);
    }

    // 7. Проверяем лимит (3 НЕУДАЧНЫЕ попытки)
    if (attemptCount >= 3) {
      console.log(
        `🔒 Блокировка пользователя ${login} (3 неудачные попытки смены пароля)`
      );

      try {
        // Блокируем пользователя
        await query(
          `UPDATE usersdata 
           SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
           WHERE login = ? AND logic = 'true'`,
          [login]
        );

        console.log(
          `✅ Пользователь ${login} заблокирован за 3 неудачные попытки`
        );

        // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
        try {
          await emailService.sendAccountBlocked({
            login: userData.login,
            email: userEmail,
            reason: "Превышено количество попыток смены пароля",
            supportUrl: config.SUPPORT_URL,
            ipAddress: req.ip || "unknown",
            userAgent: req.headers["user-agent"] || "",
          });
          console.log(`📧 Письмо о блокировке отправлено на: ${userEmail}`);
        } catch (emailError) {
          console.error(
            "❌ Ошибка отправки email о блокировке:",
            emailError.message
          );
        }
      } catch (blockError) {
        console.error("❌ Ошибка блокировки:", blockError.message);
      }

      return res.status(401).json({
        success: false,
        message:
          "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 8. Проверяем наличие кодового слова в БД
    if (!userData.secret_word || userData.secret_word.trim() === "") {
      console.log(`❌ Кодовое слово не установлено для пользователя: ${login}`);

      // Фиксируем попытку по EMAIL
      try {
        if (attemptsRecordId) {
          await query(
            "UPDATE password_reset_attempts SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?",
            [attemptsRecordId]
          );
        } else {
          await query(
            `INSERT INTO password_reset_attempts (email, attempts, last_attempt, ip_address, user_agent)
             VALUES (?, 1, NOW(), ?, ?)`,
            [userEmail, req.ip || "unknown", req.headers["user-agent"] || ""]
          );
        }
      } catch (updateError) {
        console.warn(
          "⚠️ Не удалось зафиксировать попытку:",
          updateError.message
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Для вашего аккаунта не установлено кодовое слово. Обратитесь в техническую поддержку.",
        field: "secretWord",
      });
    }

    // 9. Проверяем кодовое слово
    console.log(`🔐 Проверка кодового слова для ${login}`);
    const isValidSecretWord = await bcrypt.compare(
      trimmedSecretWord,
      userData.secret_word
    );

    console.log(
      `✅ Результат сравнения: ${isValidSecretWord ? "ВЕРНО" : "НЕВЕРНО"}`
    );

    if (!isValidSecretWord) {
      console.log(`❌ Неверное кодовое слово для ${login}`);

      // ФИКСИРУЕМ НЕУДАЧНУЮ ПОПЫТКУ по EMAIL
      try {
        let newAttemptCount = attemptCount + 1;

        if (attemptsRecordId) {
          await query(
            "UPDATE password_reset_attempts SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?",
            [attemptsRecordId]
          );
        } else {
          await query(
            `INSERT INTO password_reset_attempts (email, attempts, last_attempt, ip_address, user_agent)
             VALUES (?, 1, NOW(), ?, ?)`,
            [userEmail, req.ip || "unknown", req.headers["user-agent"] || ""]
          );
          newAttemptCount = 1;
        }

        console.log(
          `📈 Неудачная попытка зафиксирована: ${newAttemptCount}/3 (неверное кодовое слово)`
        );

        // Проверяем, не достигли ли лимита
        if (newAttemptCount >= 3) {
          console.log(`🔒 Достигнут лимит неудачных попыток - блокировка`);

          try {
            // Блокируем пользователя
            await query(
              `UPDATE usersdata 
               SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
               WHERE login = ? AND logic = 'true'`,
              [login]
            );

            console.log(`✅ Аккаунт ${login} заблокирован`);

            // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
            try {
              await emailService.sendAccountBlocked({
                login: userData.login,
                email: userEmail,
                reason: "3 неудачные попытки смены пароля",
                supportUrl: config.SUPPORT_URL,
                ipAddress: req.ip || "unknown",
                userAgent: req.headers["user-agent"] || "",
              });
              console.log(`📧 Письмо о блокировке отправлено на: ${userEmail}`);
            } catch (emailError) {
              console.error(
                "❌ Ошибка отправки email о блокировке:",
                emailError.message
              );
            }
          } catch (blockError) {
            console.error("❌ Ошибка при блокировке:", blockError.message);
          }

          return res.status(401).json({
            success: false,
            message:
              "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
          });
        }
      } catch (updateError) {
        console.warn(
          "⚠️ Не удалось зафиксировать неудачную попытку:",
          updateError.message
        );
      }

      const remainingAttempts = 3 - (attemptCount + 1);
      let message = "Неверное кодовое слово";
      if (remainingAttempts > 0) {
        message += `. Осталось попыток: ${remainingAttempts}`;
      }

      return res.status(400).json({
        success: false,
        message: message,
        field: "secretWord",
      });
    }

    // 10. Если кодовое слово ВЕРНО - удаляем все попытки по EMAIL
    console.log(`✅ Кодовое слово верно для ${login}`);
    try {
      await query("DELETE FROM password_reset_attempts WHERE email = ?", [
        userEmail,
      ]);
      console.log(`🔄 Все неудачные попытки удалены для ${userEmail}`);
    } catch (deleteError) {
      console.warn("⚠️ Не удалось удалить попытки:", deleteError.message);
    }

    // 11. Проверяем текущий пароль
    console.log(`🔑 Проверка текущего пароля для ${login}`);
    const validPassword = await bcrypt.compare(
      currentPassword,
      userData.password
    );

    if (!validPassword) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`❌ Неверный текущий пароль для ${login}`);

      return res.status(400).json({
        success: false,
        message: "Неверный текущий пароль",
        field: "currentPassword",
      });
    }

    // 12. Проверяем, что новый пароль отличается от текущего
    const samePassword = await bcrypt.compare(newPassword, userData.password);
    if (samePassword) {
      console.log(`⚠️ Новый пароль совпадает с текущим для ${login}`);
      return res.status(400).json({
        success: false,
        message: "Новый пароль должен отличаться от текущего",
        field: "newPassword",
      });
    }

    // 13. Хэшируем новый пароль
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 14. Обновляем пароль в базе
    await query(
      "UPDATE usersdata SET password = ? WHERE login = ? AND logic = 'true'",
      [hashedPassword, login]
    );
    console.log(`✅ Пароль обновлен для пользователя: ${login}`);

    // 15. Удаляем все сессии пользователя
    await query("DELETE FROM sessionsdata WHERE login = ?", [login]);
    console.log(`🗑️ Удалены все сессии пользователя: ${login}`);

    // 16. Отправляем email уведомление
    try {
      await emailService.sendPasswordChanged({
        login: login,
        email: userEmail,
        userIp: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"] || "Неизвестное устройство",
      });

      console.log(`📧 Уведомление о смене пароля отправлено на ${userEmail}`);
    } catch (emailError) {
      console.error(
        "❌ Ошибка отправки email уведомления:",
        emailError.message
      );
    }

    // 17. Возвращаем успех
    console.log(`✅ Смена пароля успешно завершена для ${login}`);

    res.json({
      success: true,
      message: "Пароль успешно изменен",
      requireReauth: true,
      emailSent: true,
    });
  } catch (error) {
    console.error("❌ Ошибка смены пароля:", error);
    console.error("📋 Stack trace:", error.stack);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка смены пароля",
    });
  }
});

// Удаление аккаунта (оптимальная версия)
router.delete("/delete-account", authenticateToken, async (req, res) => {
  let connection;

  try {
    const login = req.user.login;
    const userDir = path.join(config.UPLOAD_DIR, login);

    console.log(`🗑️ Удаление аккаунта: ${login}`);

    connection = await getConnection();
    await connection.beginTransaction();

    // Удаляем данные пользователя
    await connection.execute(`DROP TABLE IF EXISTS \`${login}\``);
    await connection.execute("DELETE FROM sessionsdata WHERE login = ?", [
      login,
    ]);

    const [userResult] = await connection.execute(
      "DELETE FROM usersdata WHERE login = ? AND logic = 'true'",
      [login]
    );

    if (userResult.affectedRows === 0) {
      throw new Error("Пользователь не найден в базе данных");
    }

    await connection.execute("DELETE FROM login_attempts WHERE login = ?", [
      login,
    ]);

    await connection.execute(
      "DELETE FROM password_resets WHERE email IN (SELECT email FROM usersdata WHERE login = ?)",
      [login]
    );

    // Удаляем файлы пользователя
    try {
      await fs.access(userDir);
      await fs.rm(userDir, { recursive: true, force: true });
      console.log(`📁 Директория пользователя удалена: ${userDir}`);
    } catch {
      console.log(`📁 Директория пользователя не найдена`);
    }

    await connection.commit();

    console.log(`✅ Аккаунт ${login} успешно удален`);

    res.json({
      success: true,
      message: "Аккаунт успешно удален",
    });
  } catch (error) {
    console.error(
      `❌ Ошибка удаления аккаунта ${req.user.login}:`,
      error.message
    );

    if (connection) {
      await connection.rollback();
    }

    const statusCode = error.message.includes("не найден") ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message.includes("не найден")
        ? "Пользователь не найден"
        : "Ошибка удаления аккаунта",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
