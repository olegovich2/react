// src/utils/databaseInitializer.js
const { query, getConnection } = require("../services/databaseService");
const config = require("../config");

class DatabaseInitializer {
  constructor() {
    this.tables = this.getTableDefinitions();
    this.diagnosesData = this.getDiagnosesData();
  }

  // Определения всех таблиц
  getTableDefinitions() {
    return {
      usersdata: `
        CREATE TABLE IF NOT EXISTS \`usersdata\` (
          \`login\` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
          \`password\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`email\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`jwt\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`logic\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`last_login\` datetime DEFAULT NULL,
          \`blocked\` tinyint(1) DEFAULT '0',
          \`secret_word\` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
          \`blocked_until\` datetime DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `,

      sessionsdata: `
        CREATE TABLE IF NOT EXISTS \`sessionsdata\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`login\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`jwt_access\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`date\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `,

      alldiagnoses: `
        CREATE TABLE IF NOT EXISTS \`alldiagnoses\` (
          \`nameOfDisease\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`nameofDiseaseRu\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`diagnostics\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
          \`treatment\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `,

      login_attempts: `
        CREATE TABLE IF NOT EXISTS \`login_attempts\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`login\` varchar(100) NOT NULL,
          \`ip_address\` varchar(45) NOT NULL,
          \`success\` tinyint(1) DEFAULT '0',
          \`user_agent\` text,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_login\` (\`login\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_ip\` (\`ip_address\`),
          KEY \`idx_success_created\` (\`success\`,\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `,

      blocked_login_attempts: `
        CREATE TABLE IF NOT EXISTS \`blocked_login_attempts\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`user_login\` varchar(255) NOT NULL,
          \`ip_address\` varchar(45) DEFAULT NULL,
          \`user_agent\` text,
          \`blocked_until\` datetime DEFAULT NULL,
          \`attempted_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          \`auto_unblocked\` tinyint(1) DEFAULT '0',
          \`unblocked_at\` timestamp NULL DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          KEY \`idx_user_login\` (\`user_login\`),
          KEY \`idx_attempted_at\` (\`attempted_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
          \`email\` varchar(255) NOT NULL,
          \`attempts\` int DEFAULT '0',
          \`last_attempt\` datetime DEFAULT NULL,
          \`ip_address\` varchar(45) DEFAULT NULL,
          \`user_agent\` text,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`email\` (\`email\`),
          KEY \`last_attempt\` (\`last_attempt\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `,

      admin_users: `
        CREATE TABLE IF NOT EXISTS \`admin_users\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`username\` varchar(50) NOT NULL,
          \`password_hash\` varchar(255) NOT NULL,
          \`email\` varchar(100) NOT NULL,
          \`full_name\` varchar(100) DEFAULT NULL,
          \`role\` enum('superadmin','admin','moderator') DEFAULT 'admin',
          \`is_active\` tinyint(1) DEFAULT '1',
          \`last_login\` timestamp NULL DEFAULT NULL,
          \`login_attempts\` int DEFAULT '0',
          \`locked_until\` timestamp NULL DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`username\` (\`username\`),
          UNIQUE KEY \`email\` (\`email\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `,

      admin_sessions: `
        CREATE TABLE IF NOT EXISTS \`admin_sessions\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`admin_id\` int NOT NULL,
          \`session_token\` varchar(500) NOT NULL,
          \`ip_address\` varchar(45) DEFAULT NULL,
          \`user_agent\` text,
          \`expires_at\` timestamp NOT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_admin_id\` (\`admin_id\`),
          KEY \`idx_session_token\` (\`session_token\`(100)),
          KEY \`idx_expires_at\` (\`expires_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `,

      admin_logs: `
        CREATE TABLE IF NOT EXISTS \`admin_logs\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`admin_id\` int NOT NULL,
          \`action_type\` varchar(50) NOT NULL COMMENT 'create, update, delete, login, logout',
          \`target_type\` varchar(50) DEFAULT NULL COMMENT 'user, setting, backup, etc',
          \`target_id\` varchar(100) DEFAULT NULL,
          \`details\` json DEFAULT NULL,
          \`ip_address\` varchar(45) DEFAULT NULL,
          \`user_agent\` text,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_admin_id\` (\`admin_id\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_action_type\` (\`action_type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
          \`setting_key\` varchar(100) NOT NULL,
          \`setting_value\` text,
          \`data_type\` enum('string','number','boolean','json','array') DEFAULT 'string',
          \`category\` varchar(50) DEFAULT 'general',
          \`description\` text,
          \`is_public\` tinyint(1) DEFAULT '0',
          \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`updated_by\` int DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`setting_key\` (\`setting_key\`),
          KEY \`idx_category\` (\`category\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `,

      system_backups: `
        CREATE TABLE IF NOT EXISTS \`system_backups\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`backup_name\` varchar(255) NOT NULL,
          \`filename\` varchar(255) NOT NULL,
          \`file_path\` varchar(500) NOT NULL,
          \`file_size\` bigint DEFAULT NULL,
          \`backup_type\` enum('full','database','files','config') DEFAULT 'database',
          \`status\` enum('pending','completed','failed','restoring') DEFAULT 'pending',
          \`created_by\` int DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          \`completed_at\` timestamp NULL DEFAULT NULL,
          \`restore_count\` int DEFAULT '0',
          \`notes\` text,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`filename\` (\`filename\`),
          KEY \`idx_status\` (\`status\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_backup_type\` (\`backup_type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `,

      system_errors: `
        CREATE TABLE IF NOT EXISTS \`system_errors\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`error_type\` varchar(50) NOT NULL COMMENT 'api, database, worker, auth',
          \`error_message\` text,
          \`stack_trace\` text,
          \`endpoint\` varchar(255) DEFAULT NULL,
          \`method\` varchar(10) DEFAULT NULL,
          \`request_body\` text,
          \`user_login\` varchar(50) DEFAULT NULL,
          \`severity\` enum('low','medium','high','critical') DEFAULT 'medium',
          \`is_resolved\` tinyint(1) DEFAULT '0',
          \`resolved_at\` timestamp NULL DEFAULT NULL,
          \`resolved_by\` int DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_severity\` (\`severity\`),
          KEY \`idx_is_resolved\` (\`is_resolved\`),
          KEY \`idx_created_at\` (\`created_at\`),
          KEY \`idx_error_type\` (\`error_type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `,
    };
  }

  // Данные для таблицы alldiagnoses
  getDiagnosesData() {
    return [
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('acuteTracheitis', 'Острый трахеит?', 'Рентген органов грудной клетки,Общий анализ крови,Осмотр врача-терапевта или врача общей практики,Мазок со слизистой глотки для определения микроорганизмов,Мазок со слизистой глотки на грибковые микроорганизмы,Ларингоскопия', 'Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('acuteBronchitis', 'Острый бронхит?', 'Рентген органов грудной клетки,Общий анализ крови,Осмотр врача-терапевта или врача общей практики', 'Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней,Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('acuteObstructiveBronchitis', 'Острый обструктивный бронхит?', 'Рентген органов грудной клетки,Общий анализ крови,Функция внешнего дыхания с пробой с бронхолитиком,Осмотр врача-терапевта или врача общей практики', 'Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней,Ингаляции через небулайзер с пульмовент-комби 1мл + 4мл изотонического раствора натрия хлорида 2 раза в день 3-5 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('acuteBronchiolitis', 'Острый бронхиолит?', 'Рентген органов грудной клетки,Общий анализ крови,Функция внешнего дыхания с пробой с бронхолитиком,Осмотр врача-терапевта или врача общей практики', 'Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней,Ингаляции через небулайзер с пульмовент-комби 1мл + 4мл изотонического раствора натрия хлорида 2 раза в день 3-5 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('chronicBronchitis', 'Хронический бронхит?', 'Рентген органов грудной клетки,Общий анализ крови,Фибробронхоскопия,Функция внешнего дыхания с пробой с бронхолитиком,Осмотр врача-терапевта или врача общей практики', 'Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('copd', 'ХОБЛ?', 'Рентген органов грудной клетки,Общий анализ крови,Общий анализ мокроты,Посев мокроты на вторичную микрофлору,Фибробронхоскопия,Функция внешнего дыхания с пробой с бронхолитиком,Консультация пульмонолога,Осмотр врача-терапевта или врача общей практики', 'Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней,Ингаляции через небулайзер с пульмовент-комби 1мл + 4мл изотонического раствора натрия хлорида 2 раза в день 3-5 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('bronchialAsthma', 'Бронхиальная астма?', 'Рентген органов грудной клетки,Общий анализ крови,Общий анализ мочи,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(СРБ),Электрокардиограмма,Общий анализ мокроты,Посев мокроты на вторичную микрофлору,Фибробронхоскопия,Функция внешнего дыхания с пробой с бронхолитиком,Консультация врача-аллерголога,Консультация пульмонолога,Консультация профпатолога,Осмотр врача-терапевта или врача общей практики', 'Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней,Ингаляции через небулайзер с пульмовент-комби 1мл + 4мл изотонического раствора натрия хлорида 2 раза в день 3-5 дней,Сальбутамол по 1-2 вдоха при приступе удушья');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('bronchoectaticLungCondition', 'Бронхоэктатическая болезнь легких?', 'Компьютерная томография органов грудной клетки,Рентген органов грудной клетки,Общий анализ крови,Общий анализ мокроты,Посев мокроты на кислотоустойчивые микроорганизмы трехкратно,Посев мокроты на GenExpert,Посев мокроты на вторичную микрофлору,Фибробронхоскопия,Функция внешнего дыхания с пробой с бронхолитиком,Консультация пульмонолога,Осмотр врача-терапевта или врача общей практики', 'Ацетилцистеин 600мг по 1 таблетке 1 раз в день 7-14 дней или Амброксол 30 мг по 1 таблетке 3 раза в день 7-14 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней,Ингаляции через небулайзер с пульмовент-комби 1мл + 4мл изотонического раствора натрия хлорида 2 раза в день 3-5 дней,Использование ингалятора для подавления секреции мокроты');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('pulmonaryTuberculosis', 'Туберкулез легких?', 'Компьютерная томография органов грудной клетки,Рентген органов грудной клетки,Общий анализ крови,Общий анализ мокроты,Посев мокроты на кислотоустойчивые микроорганизмы трехкратно,Посев мокроты на GenExpert,Посев мокроты на вторичную микрофлору,Фибробронхоскопия,Консультация врача-фтизитра,Консультация пульмонолога,Осмотр врача-терапевта или врача общей практики', 'Госпитализация в профильное отделение для лечения и обследования');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('pneumonia', 'Внегоспитальная пневмония?', 'Рентген органов грудной клетки,Общий анализ крови,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(Антистрептолизин-О| ревмофактор),Осмотр врача-терапевта или врача общей практики', 'Госпитализация в профильное отделение для лечения и обследования');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('pleuritis', 'Плеврит?', 'Компьютерная томография органов грудной клетки,Рентген органов грудной клетки,Ультразвуковое исследование плевральных полостей,Ультразвуковое исследование органов брюшной полости и почек,Ультразвуковое исследование сердца,Общий анализ мокроты,Посев мокроты на кислотоустойчивые микроорганизмы трехкратно,Посев мокроты на GenExpert,Посев мокроты на вторичную микрофлору,Фибробронхоскопия,Консультация врача-кардиолога,Консультация пульмонолога,Общий анализ крови,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(СРБ),Осмотр врача-терапевта или врача общей практики', 'Госпитализация в профильное отделение для лечения и обследования');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('pneumoniaWithBloodThroating', 'Внегоспитальная пневмония, осложненная кровохарканьем?', 'Компьютерная томография органов грудной клетки с внутривенным усилением,Фибробронхоскопия с биопсией,Осмотр врача-стоматолога,Осмотр врача-оториноларинголога,Осмотр врача торакального хирурга,Коагулограмма с Д-димерами,Общий анализ крови,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(СРБ),Осмотр врача-терапевта или врача общей практики', 'Госпитализация в профильное отделение для лечения и обследования');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('pulmonaryInfarction', 'Инфаркт-пневмония легких?', 'Компьютерная томография органов грудной клетки с внутривенным усилением,Ультразвуковое исследование вен нижних конечностей,Электрокардиограмма,Фибробронхоскопия с биопсией,Осмотр врача-хирурга,Консультация врача-кардиолога,Осмотр врача ОАРИТ,Коагулограмма с Д-димерами,Общий анализ крови,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(СРБ),Осмотр врача-терапевта или врача общей практики', 'Госпитализация в профильное отделение для лечения и обследования');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('tela', 'ТЭЛА?', 'Компьютерная томография органов грудной клетки с внутривенным усилением,Ультразвуковое исследование вен нижних конечностей,Электрокардиограмма,Осмотр врача-хирурга,Консультация врача-кардиолога,Осмотр врача ОАРИТ,Коагулограмма с Д-димерами,Общий анализ крови,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(СРБ),Осмотр врача-терапевта или врача общей практики', 'Госпитализация в профильное отделение для лечения и обследования');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('acuteRhinitis', 'Острый ринит?', 'Осмотр врача-оториноларинголога, Общий анализ крови', 'Орошать полость носа слабосолевыми растворами 3 раза в день 7 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('pollinosis', 'Поллиноз?', 'Осмотр врача-оториноларинголога,Консультация врача-аллерголога,Мазок со слизистой носа на эозинофилы,Общий анализ крови', 'Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней,Орошать полость носа слабосолевыми растворами 3 раза в день 7 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('acutePharyngitis', 'Острый фарингит?', 'Осмотр врача-оториноларинголога,Осмотр врача-стоматолога,Мазок со слизистой глотки для определения микроорганизмов,Рентгенография придаточных пазух носа,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Общий анализ крови,Общий анализ мочи', 'Полоскать полость рта и горла антисептическими растворами 3-4 раза в день 7 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('chronicPharyngitis', 'Хронический фарингит?', 'Осмотр врача-оториноларинголога,Осмотр врача-стоматолога,Осмотр врача-гастроэнтеролога,Мазок со слизистой глотки для определения микроорганизмов,Мазок со слизистой глотки на грибковые микроорганизмы,Рентгенография придаточных пазух носа,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(Антистрептолизин-О| ревмофактор),Общий анализ крови,Общий анализ мочи', 'Полоскать полость рта и горла антисептическими растворами 3-4 раза в день 7 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('acuteTonsillitis', 'Острый тонзиллит?', 'Осмотр врача-оториноларинголога,Осмотр врача-инфекциониста,Консультация врача-кардиолога,Осмотр врача-нефролога,Мазок со слизистой миндалин для определения микроорганизмов,Мазок со слизистой миндалин на грибковые микроорганизмы,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(Антистрептолизин-О| ревмофактор| СРБ),Общий анализ крови,Общий анализ мочи,Электрокардиограмма', 'Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней,Полоскать полость рта и горла антисептическими растворами 3-4 раза в день 7 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('chronicTonsillitis', 'Хронический тонзиллит?', 'Осмотр врача-оториноларинголога,Осмотр врача-инфекциониста,Консультация врача-кардиолога,Осмотр врача-нефролога,Мазок со слизистой миндалин для определения микроорганизмов,Мазок со слизистой миндалин на грибковые микроорганизмы,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(Антистрептолизин-О| ревмофактор| СРБ),Общий анализ крови,Общий анализ мочи,Электрокардиограмма', 'Полоскать полость рта и горла антисептическими растворами 3-4 раза в день 7 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('cough', 'Кашель, неясной этиологии?', 'Рентген органов грудной клетки,Рентгенография придаточных пазух носа,Ультразвуковое исследование плевральных полостей,Ультразвуковое исследование сердца,Общий анализ крови,Общий анализ мочи,Биохимический анализ крови(АЛТ| АСТ| общий белок| общий белок| мочевина| креатинин| натрий| калий| общий кальций| хлор),Биохимический анализ крови(СРБ),Электрокардиограмма,Осмотр врача-оториноларинголога,Осмотр врача-стоматолога,Консультация врача-аллерголога,Осмотр врача-терапевта или врача общей практики', 'Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('noPathology', 'На данный момент патологии не выявлено.', 'Рентген органов грудной клетки 1 раз в год,Общий анализ крови 1 раз в год,Общий анализ мочи 1 раз в год,Электрокардиограмма 1 раз в год', 'Наблюдение у врача общей практики или врача-терапевта ежегодно');",
      "INSERT INTO alldiagnoses (nameOfDisease, nameofDiseaseRu, diagnostics, treatment) VALUES ('chronicRhinitis', 'Хронический ринит?', 'Осмотр врача-оториноларинголога,Консультация врача-аллерголога,Мазок со слизистой носа на эозинофилы,Общий анализ крови', 'Орошать полость носа слабосолевыми растворами 3 раза в день 7 дней,Фенкарол 50 мг по 1 таблетке 2 раза в день 7-14 дней');",
    ];
  }

  async initialize() {
    console.log("🚀 Начало инициализации базы данных...");

    try {
      // Проверяем подключение
      const connection = await getConnection();
      console.log("✅ Подключение к БД установлено");

      // Создаем таблицы в правильном порядке
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

      // Загружаем данные диагнозов
      await this.seedDiagnosesData();

      // Создаем супер-админа (если нет)
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
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
