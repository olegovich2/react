// src/routes/auth/passwordResetRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const router = express.Router();

// Импорты
const passwordResetService = require("../../services/passwordResetService");
const emailService = require("../../utils/emailService");
const { query } = require("../../services/databaseService");
const { validatePassword } = require("../../utils/validators");
const config = require("../../config");

// Восстановление пароля - запрос с проверкой кодового слова
router.post("/forgot-password", async (req, res) => {
  console.log("📧 Запрос восстановления пароля");

  // Универсальное сообщение для безопасности (только для финального успеха)
  const SECURITY_SUCCESS_MESSAGE =
    "Если email зарегистрирован в системе, на него отправлена инструкция";

  try {
    const { email, secretWord } = req.body;
    console.log("📧 Email из запроса:", email);
    console.log(
      "🔐 Secret word из запроса:",
      secretWord ? "присутствует" : "отсутствует"
    );

    // 1. Базовая валидация email
    if (!email) {
      console.log("❌ Отсутствует email");
      return res.status(400).json({
        success: false,
        message: "Введите email адрес",
        field: "email",
      });
    }

    if (!validator.isEmail(email)) {
      console.log("❌ Невалидный email:", email);
      return res.status(400).json({
        success: false,
        message: "Введите корректный email адрес",
        field: "email",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Проверяем наличие кодового слова
    if (!secretWord) {
      console.log("❌ Отсутствует кодовое слово");
      return res.status(400).json({
        success: false,
        message: "Введите кодовое слово",
        field: "secretWord",
      });
    }

    if (typeof secretWord !== "string") {
      console.log("❌ Неверный тип кодового слова");
      return res.status(400).json({
        success: false,
        message: "Кодовое слово должно быть текстом",
        field: "secretWord",
      });
    }

    const trimmedSecretWord = secretWord.trim();

    if (trimmedSecretWord === "") {
      console.log("❌ Пустое кодовое слово");
      return res.status(400).json({
        success: false,
        message: "Введите кодовое слово",
        field: "secretWord",
      });
    }

    // 3. Задержка для предотвращения timing-атак
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Ищем пользователя ПЕРВЫМ ДЕЛОМ
    console.log(`🔍 Поиск пользователя с email: ${normalizedEmail}`);

    const userResult = await query(
      "SELECT login, email, secret_word, blocked FROM usersdata WHERE email = ? AND logic = 'true'",
      [normalizedEmail]
    );

    // 5. Проверяем результат запроса
    let user = null;

    if (userResult) {
      if (Array.isArray(userResult) && userResult.length > 0) {
        user = userResult[0];
        console.log("✅ Пользователь найден (массив):", user.login);
      } else if (userResult.login !== undefined) {
        user = userResult;
        console.log("✅ Пользователь найден (объект):", user.login);
      } else if (userResult[0] && userResult[0].login !== undefined) {
        user = userResult[0];
        console.log("✅ Пользователь найден (вложенный массив):", user.login);
      } else {
        console.log("❌ Пользователь не найден или некорректный формат данных");
      }
    }

    // 6. Получаем количество существующих попыток (если пользователь найден)
    let attemptCount = 0;
    let attemptsRecordId = null;

    if (user) {
      try {
        const attemptsResult = await query(
          "SELECT id, attempts FROM password_reset_attempts WHERE email = ?",
          [normalizedEmail]
        );

        if (attemptsResult) {
          if (Array.isArray(attemptsResult) && attemptsResult.length > 0) {
            attemptCount = attemptsResult[0].attempts || 0;
            attemptsRecordId = attemptsResult[0].id;
          } else if (attemptsResult.attempts !== undefined) {
            attemptCount = attemptsResult.attempts || 0;
            attemptsRecordId = attemptsResult.id;
          } else if (
            attemptsResult[0] &&
            attemptsResult[0].attempts !== undefined
          ) {
            attemptCount = attemptsResult[0].attempts || 0;
            attemptsRecordId = attemptsResult[0].id;
          }
        }

        console.log(
          `📊 Существующие попытки для ${normalizedEmail}: ${attemptCount}`
        );
      } catch (attemptsError) {
        console.error("❌ Ошибка получения попыток:", attemptsError.message);
      }
    }

    // 7. Если пользователя НЕТ - показываем ошибку
    if (!user) {
      console.log(`📭 Пользователь не найден: ${normalizedEmail}`);
      return res.status(404).json({
        success: false,
        message: "Пользователь с таким email не найден",
        field: "email",
      });
    }

    console.log("👤 Данные пользователя:", {
      login: user.login,
      email: user.email,
      hasSecretWord: !!user.secret_word,
      blocked: user.blocked,
    });

    // 8. Проверяем, не заблокирован ли уже пользователь
    if (user.blocked === 1) {
      console.log(`⛔ Заблокированный пользователь: ${normalizedEmail}`);
      return res.status(403).json({
        success: false,
        message: "Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 9. Проверяем лимит (3 НЕУДАЧНЫЕ попытки)
    if (attemptCount >= 3) {
      console.log(
        `🔒 Блокировка пользователя ${normalizedEmail} (3 неудачные попытки)`
      );

      try {
        // Блокируем пользователя
        await query(
          `UPDATE usersdata 
           SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
           WHERE email = ? AND logic = 'true'`,
          [normalizedEmail]
        );

        console.log(
          `✅ Пользователь ${normalizedEmail} заблокирован за 3 неудачные попытки`
        );

        // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
        try {
          await emailService.sendAccountBlocked({
            login: user.login,
            email: user.email,
            reason: "Превышено количество попыток восстановления пароля",
            supportUrl: config.SUPPORT_URL,
            ipAddress: req.ip || "unknown",
            userAgent: req.headers["user-agent"] || "",
          });
          console.log(`📧 Письмо о блокировке отправлено на: ${user.email}`);
        } catch (emailError) {
          console.error(
            "❌ Ошибка отправки email о блокировке:",
            emailError.message
          );
          // Не прерываем выполнение, если email не отправился
        }
      } catch (blockError) {
        console.error("❌ Ошибка блокировки:", blockError.message);
      }

      return res.status(403).json({
        success: false,
        message:
          "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 10. Проверяем кодовое слово
    console.log(`🔐 Проверка кодового слова для ${normalizedEmail}`);
    console.log(
      `📝 Хэш в БД: ${user.secret_word ? "присутствует" : "отсутствует"}`
    );

    // Проверяем наличие кодового слова в БД
    if (!user.secret_word || user.secret_word.trim() === "") {
      console.log(
        `❌ Кодовое слово не установлено для пользователя: ${normalizedEmail}`
      );

      // Фиксируем попытку
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
            [
              normalizedEmail,
              req.ip || "unknown",
              req.headers["user-agent"] || "",
            ]
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

    // 11. Сравниваем кодовое слово с хэшем
    console.log(`🔍 Сравнение кодового слова с хэшем...`);
    const isValidSecretWord = await bcrypt.compare(
      trimmedSecretWord,
      user.secret_word
    );

    console.log(
      `✅ Результат сравнения: ${isValidSecretWord ? "ВЕРНО" : "НЕВЕРНО"}`
    );

    if (!isValidSecretWord) {
      console.log(`❌ Неверное кодовое слово для ${normalizedEmail}`);

      // ФИКСИРУЕМ НЕУДАЧНУЮ ПОПЫТКУ
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
            [
              normalizedEmail,
              req.ip || "unknown",
              req.headers["user-agent"] || "",
            ]
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
               WHERE email = ? AND logic = 'true'`,
              [normalizedEmail]
            );

            console.log(`✅ Аккаунт ${normalizedEmail} заблокирован`);

            // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
            try {
              await emailService.sendAccountBlocked({
                login: user.login,
                email: user.email,
                reason: "3 неудачные попытки восстановления пароля",
                supportUrl: config.SUPPORT_URL,
                ipAddress: req.ip || "unknown",
                userAgent: req.headers["user-agent"] || "",
              });
              console.log(
                `📧 Письмо о блокировке отправлено на: ${user.email}`
              );
            } catch (emailError) {
              console.error(
                "❌ Ошибка отправки email о блокировке:",
                emailError.message
              );
            }
          } catch (blockError) {
            console.error("❌ Ошибка при блокировке:", blockError.message);
          }

          return res.status(403).json({
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

    // 12. Если кодовое слово ВЕРНО - удаляем все попытки
    console.log(`✅ Кодовое слово верно для ${normalizedEmail}`);

    try {
      if (attemptsRecordId) {
        await query("DELETE FROM password_reset_attempts WHERE id = ?", [
          attemptsRecordId,
        ]);
        console.log(`🔄 Все неудачные попытки удалены для ${normalizedEmail}`);
      } else {
        await query("DELETE FROM password_reset_attempts WHERE email = ?", [
          normalizedEmail,
        ]);
        console.log(
          `🔄 Все неудачные попытки удалены по email: ${normalizedEmail}`
        );
      }
    } catch (deleteError) {
      console.warn("⚠️ Не удалось удалить попытки:", deleteError.message);
    }

    // 13. Создаем токен восстановления и отправляем email
    console.log(`🔑 Создание токена для ${normalizedEmail}`);

    try {
      const resetToken = await passwordResetService.createToken(user.email);
      console.log(`✅ Токен создан: ${resetToken?.substring(0, 20)}...`);

      await emailService.sendPasswordReset({
        login: user.login,
        email: user.email,
        resetToken: resetToken,
      });

      console.log(`📧 Письмо отправлено на: ${user.email}`);
    } catch (serviceError) {
      console.error("❌ Ошибка сервиса восстановления:", serviceError.message);
    }

    // 14. Возвращаем успех
    console.log(`✅ Восстановление пароля успешно для ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: SECURITY_SUCCESS_MESSAGE,
    });
  } catch (error) {
    console.error("❌ Ошибка обработки запроса восстановления пароля:", error);
    console.error("📋 Stack trace:", error.stack);

    res.status(500).json({
      success: false,
      message: "Произошла ошибка при обработке запроса. Попробуйте позже.",
    });
  }
});

// Проверка токена восстановления
router.get("/validate-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 10) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "Некорректный токен",
      });
    }

    const validation = await passwordResetService.validateToken(token);

    res.json({
      success: true,
      valid: validation.valid,
      email: validation.valid ? validation.email : undefined,
      message: validation.message,
      expiresAt: validation.valid ? validation.expiresAt : undefined,
    });
  } catch (error) {
    console.error("❌ Ошибка проверки токена восстановления:", error);
    res.status(500).json({
      success: false,
      valid: false,
      message: "Ошибка проверки токена",
    });
  }
});

// Установка нового пароля
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Токен и новый пароль обязательны",
        field: !token ? "token" : "newPassword",
      });
    }

    try {
      validatePassword(newPassword);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
        field: "newPassword",
      });
    }

    const validation = await passwordResetService.validateToken(token);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message || "Токен недействителен или устарел",
      });
    }

    const { email, resetId } = validation;

    const users = await query(
      "SELECT login, password FROM usersdata WHERE email = ? AND logic = 'true'",
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    const user = users[0];
    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "Новый пароль должен отличаться от текущего",
        field: "newPassword",
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await query(
      "UPDATE usersdata SET password = ? WHERE email = ? AND logic = 'true'",
      [hashedPassword, email]
    );

    await passwordResetService.markAsUsed(resetId);
    await query("DELETE FROM sessionsdata WHERE login = ?", [user.login]);

    try {
      await emailService.sendPasswordChanged({
        login: user.login,
        email: email,
        userIp: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"] || "Неизвестное устройство",
      });
      console.log(`📧 Уведомление об изменении пароля отправлено на ${email}`);
    } catch (emailError) {
      console.warn(
        "⚠️ Не удалось отправить email уведомление:",
        emailError.message
      );
    }

    console.log(`✅ Пароль изменен для пользователя: ${user.login}`);

    res.json({
      success: true,
      message:
        "Пароль успешно изменен. Теперь вы можете войти с новым паролем.",
      requireReauth: true,
      emailSent: true,
    });
  } catch (error) {
    console.error("❌ Ошибка установки нового пароля:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка установки нового пароля. Попробуйте позже.",
    });
  }
});

module.exports = router;
