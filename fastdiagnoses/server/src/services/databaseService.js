const mysql = require("mysql2/promise");
const config = require("../config");
const logger = require("./LoggerService");

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
    logger.warn("Соединение с базой данных установлено", {
      type: "database",
      action: "connection_test",
      status: "success",
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    logger.error("Ошибка подключения к базе данных", {
      type: "database",
      action: "connection_test",
      status: "failed",
      error_message: error.message,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}

module.exports = {
  pool,
  getConnection,
  query,
  testConnection,
};
