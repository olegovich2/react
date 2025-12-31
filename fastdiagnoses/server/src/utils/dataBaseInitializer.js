// src/utils/databaseInitializer.js
const {
  query,
  getConnection,
  getConnectionWithoutDB,
} = require("../services/databaseService");
const config = require("../config");

class DatabaseInitializer {
  constructor() {
    this.databaseName = "diagnoses"; // Название вашей БД
    this.tables = this.getTableDefinitions();
    this.diagnosesData = this.getDiagnosesData();
  }

  // Создание базы данных если не существует
  async createDatabaseIfNotExists() {
    console.log(`🔄 Проверка существования БД: ${this.databaseName}`);

    try {
      // Получаем соединение без конкретной БД
      const connectionWithoutDB = await getConnectionWithoutDB();

      // Проверяем, существует ли БД
      const [databases] = await connectionWithoutDB.execute(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
        [this.databaseName]
      );

      if (databases.length === 0) {
        console.log(`📦 Создание БД: ${this.databaseName}`);

        // Создаем БД с правильной кодировкой
        await connectionWithoutDB.execute(
          `CREATE DATABASE \`${this.databaseName}\` 
           CHARACTER SET utf8mb4 
           COLLATE utf8mb4_unicode_ci`
        );

        console.log(
          `✅ БД ${this.databaseName} создана с кодировкой utf8mb4_unicode_ci`
        );
      } else {
        console.log(`✅ БД ${this.databaseName} уже существует`);
      }

      // Обновляем кодировку существующей БД (на всякий случай)
      try {
        await connectionWithoutDB.execute(
          `ALTER DATABASE \`${this.databaseName}\` 
           CHARACTER SET utf8mb4 
           COLLATE utf8mb4_unicode_ci`
        );
        console.log(`🔄 Кодировка БД обновлена на utf8mb4_unicode_ci`);
      } catch (alterError) {
        console.log(`ℹ️ Кодировка БД уже правильная: ${alterError.message}`);
      }

      connectionWithoutDB.release();
      return true;
    } catch (error) {
      console.error(`❌ Ошибка создания/проверки БД:`, error);
      throw error;
    }
  }

  // Определения всех таблиц с единой кодировкой
  getTableDefinitions() {
    return {
      usersdata: `
        CREATE TABLE IF NOT EXISTS \`usersdata\` (
          \`login\` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`password\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`email\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`jwt\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`logic\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`last_login\` datetime DEFAULT NULL,
          \`blocked\` tinyint(1) DEFAULT '0',
          \`secret_word\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`blocked_until\` datetime DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      sessionsdata: `
        CREATE TABLE IF NOT EXISTS \`sessionsdata\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`login\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`jwt_access\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`date\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      alldiagnoses: `
        CREATE TABLE IF NOT EXISTS \`alldiagnoses\` (
          \`nameOfDisease\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`nameofDiseaseRu\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`diagnostics\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`treatment\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      login_attempts: `
        CREATE TABLE IF NOT EXISTS \`login_attempts\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`login\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`ip_address\` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`success\` tinyint(1) DEFAULT '0',
          \`user_agent\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_login\` (\`login\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_ip\` (\`ip_address\`),
          KEY \`idx_success_created\` (\`success\`,\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      blocked_login_attempts: `
        CREATE TABLE IF NOT EXISTS \`blocked_login_attempts\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`user_login\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`ip_address\` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`user_agent\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`blocked_until\` datetime DEFAULT NULL,
          \`attempted_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          \`auto_unblocked\` tinyint(1) DEFAULT '0',
          \`unblocked_at\` timestamp NULL DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          KEY \`idx_user_login\` (\`user_login\`),
          KEY \`idx_attempted_at\` (\`attempted_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      password_resets: `
        CREATE TABLE IF NOT EXISTS \`password_resets\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`token\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`expires_at\` datetime NOT NULL,
          \`used\` tinyint(1) DEFAULT '0',
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_email\` (\`email\`),
          KEY \`idx_token\` (\`token\`),
          KEY \`idx_expires\` (\`expires_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      password_reset_attempts: `
        CREATE TABLE IF NOT EXISTS \`password_reset_attempts\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`attempts\` int DEFAULT '0',
          \`last_attempt\` datetime DEFAULT NULL,
          \`ip_address\` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`user_agent\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`email\` (\`email\`),
          KEY \`last_attempt\` (\`last_attempt\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      admin_users: `
        CREATE TABLE IF NOT EXISTS \`admin_users\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`username\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`password_hash\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`email\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`full_name\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`role\` enum('superadmin','admin','moderator') COLLATE utf8mb4_unicode_ci DEFAULT 'admin',
          \`is_active\` tinyint(1) DEFAULT '1',
          \`last_login\` timestamp NULL DEFAULT NULL,
          \`login_attempts\` int DEFAULT '0',
          \`locked_until\` timestamp NULL DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`username\` (\`username\`),
          UNIQUE KEY \`email\` (\`email\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      admin_sessions: `
        CREATE TABLE IF NOT EXISTS \`admin_sessions\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`admin_id\` int NOT NULL,
          \`session_token\` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`ip_address\` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`user_agent\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`expires_at\` timestamp NOT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_admin_id\` (\`admin_id\`),
          KEY \`idx_session_token\` (\`session_token\`(100)),
          KEY \`idx_expires_at\` (\`expires_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      admin_logs: `
        CREATE TABLE IF NOT EXISTS \`admin_logs\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`admin_id\` int NOT NULL,
          \`action_type\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'create, update, delete, login, logout',
          \`target_type\` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'user, setting, backup, support, etc',
          \`target_id\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`details\` json DEFAULT NULL,
          \`ip_address\` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`user_agent\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_admin_id\` (\`admin_id\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_action_type\` (\`action_type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      support_requests: `
        CREATE TABLE IF NOT EXISTS \`support_requests\` (
          \`id\` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
          \`public_id\` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`type\` enum('password_reset','email_change','unblock','account_deletion','other') COLLATE utf8mb4_unicode_ci NOT NULL,
          \`login\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`secret_word_hash\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`message\` text COLLATE utf8mb4_unicode_ci NOT NULL,
          \`new_email\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`block_reason\` text COLLATE utf8mb4_unicode_ci,
          \`status\` enum('pending','confirmed','in_progress','resolved','rejected','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
          \`admin_notes\` text COLLATE utf8mb4_unicode_ci,
          \`admin_id\` int DEFAULT NULL,
          \`resolved_at\` datetime DEFAULT NULL,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`password\` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`public_id\` (\`public_id\`),
          KEY \`idx_status\` (\`status\`),
          KEY \`idx_type\` (\`type\`),
          KEY \`idx_email\` (\`email\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_login\` (\`login\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      support_confirmation_tokens: `
        CREATE TABLE IF NOT EXISTS \`support_confirmation_tokens\` (
          \`id\` bigint NOT NULL AUTO_INCREMENT,
          \`token\` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`request_id\` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`is_used\` tinyint(1) DEFAULT '0',
          \`expires_at\` datetime NOT NULL,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          \`used_at\` datetime DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`token\` (\`token\`),
          KEY \`idx_request_id\` (\`request_id\`),
          KEY \`idx_expires_at\` (\`expires_at\`),
          KEY \`idx_email\` (\`email\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      support_request_logs: `
        CREATE TABLE IF NOT EXISTS \`support_request_logs\` (
          \`id\` bigint NOT NULL AUTO_INCREMENT,
          \`request_id\` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`action\` enum('created','email_confirmed','status_changed','admin_note_added','admin_note_updated','email_sent','secret_verified','viewed') COLLATE utf8mb4_unicode_ci NOT NULL,
          \`old_value\` text COLLATE utf8mb4_unicode_ci,
          \`new_value\` text COLLATE utf8mb4_unicode_ci,
          \`actor_type\` enum('system','user','admin') COLLATE utf8mb4_unicode_ci DEFAULT 'system',
          \`actor_id\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_request_id\` (\`request_id\`),
          KEY \`idx_action\` (\`action\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_actor\` (\`actor_type\`,\`actor_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      system_settings: `
        CREATE TABLE IF NOT EXISTS \`system_settings\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`setting_key\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`setting_value\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`data_type\` enum('string','number','boolean','json','array') COLLATE utf8mb4_unicode_ci DEFAULT 'string',
          \`category\` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'general',
          \`description\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`is_public\` tinyint(1) DEFAULT '0',
          \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`updated_by\` int DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`setting_key\` (\`setting_key\`),
          KEY \`idx_category\` (\`category\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      system_backups: `
        CREATE TABLE IF NOT EXISTS \`system_backups\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`backup_name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`filename\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`file_path\` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
          \`file_size\` bigint DEFAULT NULL,
          \`backup_type\` enum('full','database','files','config') COLLATE utf8mb4_unicode_ci DEFAULT 'database',
          \`status\` enum('pending','completed','failed','restoring') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
          \`created_by\` int DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          \`completed_at\` timestamp NULL DEFAULT NULL,
          \`restore_count\` int DEFAULT '0',
          \`notes\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`filename\` (\`filename\`),
          KEY \`idx_status\` (\`status\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_backup_type\` (\`backup_type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      system_errors: `
        CREATE TABLE IF NOT EXISTS \`system_errors\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`error_type\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'api, database, worker, auth',
          \`error_message\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`stack_trace\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`endpoint\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`method\` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`request_body\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
          \`user_login\` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
          \`severity\` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
          \`is_resolved\` tinyint(1) DEFAULT '0',
          \`resolved_at\` timestamp NULL DEFAULT NULL,
          \`resolved_by\` int DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_severity\` (\`severity\`),
          KEY \`idx_is_resolved\` (\`is_resolved\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_error_type\` (\`error_type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,

      file_deletion_queue: `
  CREATE TABLE IF NOT EXISTS \`file_deletion_queue\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`user_login\` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    \`table_name\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Имя таблицы пользователя (логин)',
    \`file_path\` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Полный путь к файлу',
    \`file_uuid\` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'UUID файла для связи',
    \`file_type\` enum('image','survey','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'image',
    \`scheduled_at\` datetime NOT NULL COMMENT 'Когда запланировано удаление',
    \`processed_at\` datetime DEFAULT NULL COMMENT 'Когда фактически удалено',
    \`status\` enum('pending','processing','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
    \`retry_count\` int DEFAULT '0',
    \`error_message\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`idx_status\` (\`status\`),
    KEY \`idx_scheduled_at\` (\`scheduled_at\`),
    KEY \`idx_user_login\` (\`user_login\`),
    KEY \`idx_processed_at\` (\`processed_at\`),
    KEY \`idx_retry_count\` (\`retry_count\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Очередь отложенного удаления файлов'
`,
    };
  }

  // Данные для таблицы alldiagnoses (без изменений)
  getDiagnosesData() {
    return [
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('acuteTracheitis', 'Острый трахеит?', 'Рентген органов грудной клетки,Общий анализ крови,Осмотр врача-терапевта или врача общей практики,Мазок со слизистой глотки для определения микроорганизмов,Мазок со слизистой глотки на грибковые микроорганизмы,Ларингоскопия', 'Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
      // ... остальные INSERT-запросы (оставь как есть)
    ];
  }

  async initialize() {
    console.log("🚀 Начало инициализации базы данных...");

    try {
      // 1. Создаем/проверяем БД
      await this.createDatabaseIfNotExists();

      // 2. Проверяем подключение к конкретной БД
      const connection = await getConnection();
      console.log("✅ Подключение к БД установлено");

      // 3. Создаем таблицы в правильном порядке
      const tableOrder = [
        "usersdata",
        "sessionsdata",
        "alldiagnoses",
        "admin_users",
        "admin_sessions",
        "admin_logs",
        "login_attempts",
        "blocked_login_attempts",
        "password_resets",
        "password_reset_attempts",
        "support_requests",
        "support_confirmation_tokens",
        "support_request_logs",
        "system_settings",
        "system_backups",
        "system_errors",
        "file_deletion_queue",
      ];

      for (const tableName of tableOrder) {
        console.log(`🔄 Создание таблицы: ${tableName}`);
        try {
          await query(this.tables[tableName]);
          console.log(`✅ Таблица ${tableName} создана/проверена`);
        } catch (error) {
          console.error(
            `❌ Ошибка создания таблицы ${tableName}:`,
            error.message
          );
        }
      }

      // 4. Загружаем данные диагнозов
      await this.seedDiagnosesData();

      // 5. Создаем супер-админа (если нет)
      await this.createSuperAdmin();

      console.log("✅ Инициализация базы данных завершена успешно!");

      connection.release();
      return true;
    } catch (error) {
      console.error("❌ Ошибка инициализации:", error);
      throw error;
    }
  }

  async seedDiagnosesData() {
    try {
      // Проверяем, есть ли уже данные
      const [rows] = await query("SELECT COUNT(*) as count FROM alldiagnoses");

      if (rows[0].count === 0) {
        console.log("🌱 Загружаем данные диагнозов...");

        // Выполняем все INSERT команды
        for (const sql of this.diagnosesData) {
          await query(sql);
        }

        console.log(
          `✅ Загружено ${this.diagnosesData.length} диагнозов в alldiagnoses`
        );
      } else {
        console.log(`✅ В alldiagnoses уже есть ${rows[0].count} записей`);
      }
    } catch (error) {
      console.warn(
        "⚠️ Не удалось загрузить данные в alldiagnoses:",
        error.message
      );
    }
  }

  async createSuperAdmin() {
    try {
      const [admins] = await query("SELECT COUNT(*) as count FROM admin_users");

      if (admins[0].count === 0) {
        console.log(
          "👑 Таблица admin_users пуста, создайте первого админа вручную"
        );
        console.log("⚠️ Используйте интерфейс админки или вставьте в БД:");
        console.log("   username: admin");
        console.log("   password_hash: [хеш пароля]");
        console.log("   email: admin@example.com");
        console.log("   role: superadmin");
      }
    } catch (error) {
      console.warn("⚠️ Не удалось проверить админов:", error.message);
    }
  }

  // Метод для создания таблиц пользователей динамически
  async createUserTable(login) {
    const tableName = `\`${login}\``;
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_uuid VARCHAR(36),
        fileNameOriginIMG VARCHAR(255),
        file_path VARCHAR(500),
        thumbnail_path VARCHAR(500),
        comment TEXT,
        file_size INT,
        mime_type VARCHAR(100),
        file_hash VARCHAR(64),
        width INT,
        height INT,
        survey JSON,
        type ENUM('image', 'survey'),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_created_at (created_at),
        INDEX idx_file_uuid (file_uuid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    try {
      await query(createTableSQL);
      console.log(`✅ Таблица пользователя ${login} создана/проверена`);
      return true;
    } catch (error) {
      console.error(
        `❌ Ошибка создания таблицы пользователя ${login}:`,
        error.message
      );
      throw error;
    }
  }
}

module.exports = new DatabaseInitializer();
