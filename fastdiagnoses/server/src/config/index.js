require("dotenv").config();

const constants = require("./constants");
const database = require("./database");

module.exports = {
  // Сервер
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_SECRET_TWO: process.env.JWT_SECRET_TWO,

  // Email (только переменные, транспортер создадим отдельно)
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,

  // Worker
  IMAGE_WORKERS: parseInt(process.env.IMAGE_WORKERS) || 2,

  // Клиентский URL (для ссылок)
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5000",

  // Константы
  ...constants,

  // База данных
  database: database.poolConfig,
};
