const { query } = require("./databaseService");
const { ensureUserUploadDirs } = require("../utils/fileSystem");
const logger = require("./LoggerService");

class UserTableService {
  /**
   * Создает таблицу для пользователя и необходимые директории
   * @param {string} login - Логин пользователя
   * @returns {Promise<boolean>} Успешно ли создана таблица
   */
  async createUserTable(login) {
    const startTime = Date.now();

    try {
      // SQL для создания таблицы пользователя
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS \`${login}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          file_uuid VARCHAR(36) NOT NULL,
          fileNameOriginIMG VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          thumbnail_path VARCHAR(500) NOT NULL,
          comment TEXT,
          file_size BIGINT NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          file_hash VARCHAR(64) NOT NULL,
          width INT NOT NULL,
          height INT NOT NULL,
          survey LONGTEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          type ENUM('survey', 'image') DEFAULT 'survey',
          UNIQUE KEY idx_file_uuid_unique (file_uuid),
          INDEX idx_filename (fileNameOriginIMG),
          INDEX idx_created_at (created_at DESC),
          INDEX idx_type (type),
          INDEX idx_created_type (created_at, type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;

      await query(createTableSQL);

      // Создаем директории для файлов пользователя
      await ensureUserUploadDirs(login);

      const executionTime = Date.now() - startTime;

      logger.warn("Таблица пользователя создана", {
        type: "user_table",
        action: "create",
        user_login: login,
        status: "success",
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      logger.error("Ошибка создания таблицы пользователя", {
        type: "user_table",
        action: "create",
        user_login: login,
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Проверяет, существует ли таблица пользователя
   * @param {string} login - Логин пользователя
   * @returns {Promise<boolean>} Существует ли таблица
   */
  async tableExists(login) {
    const startTime = Date.now();

    try {
      const result = await query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [process.env.DB_DATABASE || "diagnoses", login]
      );

      const exists = result[0].count > 0;
      const executionTime = Date.now() - startTime;

      logger.info("Проверка существования таблицы пользователя", {
        type: "user_table",
        action: "check_exists",
        user_login: login,
        table_exists: exists,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return exists;
    } catch (error) {
      logger.error("Ошибка проверки таблицы пользователя", {
        type: "user_table",
        action: "check_exists",
        user_login: login,
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }

  /**
   * Удаляет таблицу пользователя (для cleanup или удаления аккаунта)
   * @param {string} login - Логин пользователя
   * @returns {Promise<boolean>} Успешно ли удалена таблица
   */
  async dropUserTable(login) {
    const startTime = Date.now();

    try {
      await query(`DROP TABLE IF EXISTS \`${login}\``);

      const executionTime = Date.now() - startTime;

      logger.warn("Таблица пользователя удалена", {
        type: "user_table",
        action: "drop",
        user_login: login,
        status: "success",
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      logger.error("Ошибка удаления таблицы пользователя", {
        type: "user_table",
        action: "drop",
        user_login: login,
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }

  /**
   * Получает информацию о таблице пользователя
   * @param {string} login - Логин пользователя
   * @returns {Promise<Object|null>} Информация о таблице
   */
  async getTableInfo(login) {
    const startTime = Date.now();

    try {
      const [tables] = await query(
        `SELECT 
          TABLE_NAME as table_name,
          TABLE_ROWS as rows_count,
          DATA_LENGTH as data_size,
          INDEX_LENGTH as index_size,
          CREATE_TIME as created_at
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [process.env.DB_DATABASE || "diagnoses", login]
      );

      const executionTime = Date.now() - startTime;

      if (tables.length === 0) {
        logger.info("Таблица пользователя не найдена", {
          type: "user_table",
          action: "get_info",
          user_login: login,
          table_exists: false,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString(),
        });
        return null;
      }

      const tableInfo = {
        tableName: tables[0].table_name,
        rowCount: tables[0].rows_count,
        dataSize: tables[0].data_size,
        indexSize: tables[0].index_size,
        createdAt: tables[0].created_at,
        totalSize: (tables[0].data_size + tables[0].index_size) / 1024 / 1024, // MB
      };

      logger.info("Получена информация о таблице пользователя", {
        type: "user_table",
        action: "get_info",
        user_login: login,
        table_exists: true,
        table_info: tableInfo,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return tableInfo;
    } catch (error) {
      logger.error("Ошибка получения информации о таблице пользователя", {
        type: "user_table",
        action: "get_info",
        user_login: login,
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  /**
   * Создает таблицу если она не существует
   * @param {string} login - Логин пользователя
   * @returns {Promise<boolean>} Существовала ли таблица до создания
   */
  async createTableIfNotExists(login) {
    const startTime = Date.now();

    try {
      const exists = await this.tableExists(login);

      if (!exists) {
        await this.createUserTable(login);

        logger.warn("Таблица пользователя создана (не существовала)", {
          type: "user_table",
          action: "create_if_not_exists",
          user_login: login,
          table_existed_before: false,
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });

        return false; // Таблицы не было, создали
      }

      logger.info("Таблица пользователя уже существует", {
        type: "user_table",
        action: "create_if_not_exists",
        user_login: login,
        table_existed_before: true,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return true; // Таблица уже существовала
    } catch (error) {
      logger.error("Ошибка создания таблицы если не существует", {
        type: "user_table",
        action: "create_if_not_exists",
        user_login: login,
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}

// Экспортируем singleton экземпляр
const userTableService = new UserTableService();

module.exports = userTableService;
