const { query } = require("./databaseService");
const { ensureUserUploadDirs } = require("../utils/fileSystem");

class UserTableService {
  /**
   * Создает таблицу для пользователя и необходимые директории
   * @param {string} login - Логин пользователя
   * @returns {Promise<boolean>} Успешно ли создана таблица
   */
  async createUserTable(login) {
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

      console.log(`✅ Таблица пользователя создана: ${login}`);
      return true;
    } catch (error) {
      console.error(`❌ Ошибка создания таблицы для ${login}:`, error.message);
      throw error;
    }
  }

  /**
   * Проверяет, существует ли таблица пользователя
   * @param {string} login - Логин пользователя
   * @returns {Promise<boolean>} Существует ли таблица
   */
  async tableExists(login) {
    try {
      const result = await query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [process.env.DB_DATABASE || "diagnoses", login]
      );
      return result[0].count > 0;
    } catch (error) {
      console.error(`❌ Ошибка проверки таблицы ${login}:`, error.message);
      return false;
    }
  }

  /**
   * Удаляет таблицу пользователя (для cleanup или удаления аккаунта)
   * @param {string} login - Логин пользователя
   * @returns {Promise<boolean>} Успешно ли удалена таблица
   */
  async dropUserTable(login) {
    try {
      await query(`DROP TABLE IF EXISTS \`${login}\``);
      console.log(`✅ Таблица пользователя удалена: ${login}`);
      return true;
    } catch (error) {
      console.error(`❌ Ошибка удаления таблицы ${login}:`, error.message);
      return false;
    }
  }

  /**
   * Получает информацию о таблице пользователя
   * @param {string} login - Логин пользователя
   * @returns {Promise<Object|null>} Информация о таблице
   */
  async getTableInfo(login) {
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

      if (tables.length === 0) {
        return null;
      }

      return {
        tableName: tables[0].table_name,
        rowCount: tables[0].rows_count,
        dataSize: tables[0].data_size,
        indexSize: tables[0].index_size,
        createdAt: tables[0].created_at,
        totalSize: (tables[0].data_size + tables[0].index_size) / 1024 / 1024, // MB
      };
    } catch (error) {
      console.error(
        `❌ Ошибка получения информации о таблице ${login}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Создает таблицу если она не существует
   * @param {string} login - Логин пользователя
   * @returns {Promise<boolean>} Существовала ли таблица до создания
   */
  async createTableIfNotExists(login) {
    const exists = await this.tableExists(login);

    if (!exists) {
      await this.createUserTable(login);
      return false; // Таблицы не было, создали
    }

    return true; // Таблица уже существовала
  }
}

// Экспортируем singleton экземпляр
const userTableService = new UserTableService();

module.exports = userTableService;
