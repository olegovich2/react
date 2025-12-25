const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function fixAdminPassword() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "diagnoses",
  });

  try {
    const password = "admin123";

    // Генерируем правильный хеш
    console.log("🔧 Генерирую новый хеш для пароля:", password);
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(password, salt);

    console.log("✅ Новый хеш создан:");
    console.log("Хеш:", newHash);
    console.log("Длина:", newHash.length);
    console.log("Начинается с:", newHash.substring(0, 7));

    // Проверяем текущего админа
    const [currentAdmin] = await connection.execute(
      "SELECT id, username, password_hash, LENGTH(password_hash) as hash_len FROM admin_users WHERE username = ?",
      ["admin"]
    );

    if (currentAdmin.length === 0) {
      console.log("❌ Админ не найден, создаю нового...");

      await connection.execute(
        `INSERT INTO admin_users (username, password_hash, email, role, is_active, created_at) 
         VALUES (?, ?, ?, ?, 1, NOW())`,
        ["admin", newHash, "trmailforupfile@gmail.com", "admin"]
      );

      console.log("✅ Новый админ создан");
    } else {
      console.log("🔍 Найден существующий админ:");
      console.log("ID:", currentAdmin[0].id);
      console.log("Текущая длина хеша:", currentAdmin[0].hash_len);
      console.log(
        "Текущий хеш (первые 30 символов):",
        currentAdmin[0].password_hash?.substring(0, 30)
      );

      // Обновляем хеш
      await connection.execute(
        "UPDATE admin_users SET password_hash = ? WHERE username = ?",
        [newHash, "admin"]
      );

      console.log("✅ Хеш пароля обновлен");
    }

    // Проверяем результат
    const [updatedAdmin] = await connection.execute(
      "SELECT username, LENGTH(password_hash) as hash_len FROM admin_users WHERE username = ?",
      ["admin"]
    );

    console.log("\n📊 Результат:");
    console.log("Имя пользователя:", updatedAdmin[0].username);
    console.log("Длина хеша после обновления:", updatedAdmin[0].hash_len);
    console.log("✅ Должна быть 60 символов");

    // Тестируем хеш
    const testResult = await bcrypt.compare(password, newHash);
    console.log("✅ Тест проверки пароля:", testResult ? "УСПЕХ" : "НЕУДАЧА");
  } catch (error) {
    console.error("❌ Ошибка:", error);
  } finally {
    await connection.end();
    console.log("\n🔒 Соединение с БД закрыто");
  }
}

fixAdminPassword();
