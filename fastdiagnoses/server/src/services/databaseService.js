const mysql = require("mysql2/promise");
const config = require("../config");

// Создаем pool
const pool = mysql.createPool(config.database);

// Получение соединения
async function getConnection() {
  return await pool.getConnection();
}

// Выполнение запроса
async function query(sql, params = []) {
  const connection = await getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    connection.release();
  }
}

// Проверка соединения
async function testConnection() {
  try {
    const connection = await getConnection();
    await connection.ping();
    connection.release();
    console.log("✅ Соединение с базой данных установлено");
    return true;
  } catch (error) {
    console.error("❌ Ошибка подключения к базе данных:", error.message);
    return false;
  }
}

module.exports = {
  pool,
  getConnection,
  query,
  testConnection,
};
