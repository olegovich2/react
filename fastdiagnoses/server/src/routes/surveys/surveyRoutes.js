// src/routes/surveys/surveyRoutes.js
const express = require("express");
const router = express.Router();

// Импорты
const { authenticateToken } = require("../../middleware/auth");
const { validateSurvey } = require("../../utils/validators");
const userTableService = require("../../services/userTableService");
const { query, getConnection } = require("../../services/databaseService");
const logger = require("../../services/LoggerService");

// Сохранение опроса
router.post("/save", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;

  try {
    logger.info("Начало сохранения опроса", {
      type: "survey",
      action: "save_start",
      user_login: login,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    const survey = validateSurvey(req.body.survey);

    if (!survey) {
      logger.warn("Данные опроса отсутствуют", {
        type: "survey",
        action: "save_failed",
        status: "no_survey_data",
        user_login: login,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Данные опроса отсутствуют",
      });
    }

    const tableExists = await userTableService.tableExists(login);
    if (!tableExists) {
      logger.info("Создание таблицы пользователя при сохранении опроса", {
        type: "survey",
        action: "create_user_table",
        user_login: login,
        timestamp: new Date().toISOString(),
      });
      await userTableService.createUserTable(login);
    }

    await query(
      `INSERT INTO \`${login}\` (survey, type) VALUES (?, 'survey')`,
      [JSON.stringify(survey)]
    );

    const executionTime = Date.now() - startTime;

    logger.info("Опрос успешно сохранен", {
      type: "survey",
      action: "save_success",
      user_login: login,
      survey_data_present: true,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Опрос сохранен успешно",
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;

    if (error.name === "ValidationError") {
      logger.warn("Ошибка валидации опроса", {
        type: "survey",
        action: "save_failed",
        status: "validation_error",
        user_login: login,
        error_name: error.name,
        error_message: error.message,
        field: error.field,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    logger.error("Ошибка сохранения опроса", {
      type: "survey",
      action: "save_error",
      user_login: login,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка сохранения опроса",
    });
  }
});

// Получение опросов с пагинацией
router.post("/paginated", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;

  try {
    logger.info("Начало получения опросов с пагинацией", {
      type: "survey",
      action: "get_paginated_start",
      user_login: login,
      endpoint: req.path,
      method: req.method,
      page: req.body.page,
      limit: req.body.limit,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    const { page = 1, limit = 5 } = req.body;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      const executionTime = Date.now() - startTime;

      logger.warn("Некорректный номер страницы при пагинации опросов", {
        type: "survey",
        action: "get_paginated_failed",
        status: "invalid_page",
        user_login: login,
        provided_page: page,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Некорректный номер страницы",
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      const executionTime = Date.now() - startTime;

      logger.warn("Некорректный лимит при пагинации опросов", {
        type: "survey",
        action: "get_paginated_failed",
        status: "invalid_limit",
        user_login: login,
        provided_limit: limit,
        max_allowed: 50,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Некорректный лимит (максимум 50 записей на страницу)",
      });
    }

    const offset = (pageNum - 1) * limitNum;

    const tableExists = await userTableService.tableExists(login);

    if (!tableExists) {
      const executionTime = Date.now() - startTime;

      logger.info("Таблица пользователя не найдена при пагинации опросов", {
        type: "survey",
        action: "get_paginated_empty",
        user_login: login,
        table_exists: false,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        surveys: [],
        pagination: {
          currentPage: pageNum,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limitNum,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM \`${login}\` WHERE survey IS NOT NULL`
    );
    const totalItems = countResult[0].total || 0;
    const totalPages = Math.ceil(totalItems / limitNum);

    const sqlQuery = `
      SELECT id, survey, created_at FROM \`${login}\` 
      WHERE survey IS NOT NULL 
      ORDER BY created_at DESC, id DESC 
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const surveys = await query(sqlQuery);

    const parsedSurveys = surveys.map((row) => {
      try {
        const surveyData = JSON.parse(row.survey);
        return {
          id: row.id,
          date: row.created_at,
          survey: surveyData,
        };
      } catch (parseError) {
        logger.warn("Ошибка парсинга данных опроса", {
          type: "survey",
          action: "parse_survey_error",
          user_login: login,
          survey_id: row.id,
          error_message: parseError.message,
          timestamp: new Date().toISOString(),
        });

        return {
          id: row.id,
          date: row.created_at,
          survey: { date: row.created_at },
        };
      }
    });

    const executionTime = Date.now() - startTime;

    logger.info("Опросы успешно получены с пагинацией", {
      type: "survey",
      action: "get_paginated_success",
      user_login: login,
      surveys_count: parsedSurveys.length,
      total_items: totalItems,
      total_pages: totalPages,
      current_page: pageNum,
      items_per_page: limitNum,
      parsed_errors:
        surveys.length -
        parsedSurveys.filter((s) => s.survey.date === s.date).length,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      surveys: parsedSurveys,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalItems,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;

    if (error.code === "ER_NO_SUCH_TABLE") {
      logger.warn("Таблица пользователя не найдена", {
        type: "survey",
        action: "get_paginated_failed",
        status: "table_not_found",
        user_login: login,
        error_code: error.code,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        surveys: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(req.body.limit) || 5,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    logger.error("Ошибка получения опросов с пагинацией", {
      type: "survey",
      action: "get_paginated_error",
      user_login: login,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка получения опросов",
    });
  }
});

// Получение конкретного опроса
router.get("/:id", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;
  const surveyId = req.params.id;

  try {
    logger.info("Начало получения конкретного опроса", {
      type: "survey",
      action: "get_single_start",
      user_login: login,
      survey_id: surveyId,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    if (!surveyId || isNaN(parseInt(surveyId))) {
      const executionTime = Date.now() - startTime;

      logger.warn("Некорректный ID опроса", {
        type: "survey",
        action: "get_single_failed",
        status: "invalid_id",
        user_login: login,
        provided_id: surveyId,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Некорректный ID",
      });
    }

    const sql = `SELECT survey FROM \`${login}\` WHERE id = ? AND survey IS NOT NULL`;
    const results = await query(sql, [parseInt(surveyId)]);

    if (results.length === 0) {
      const executionTime = Date.now() - startTime;

      logger.warn("Опрос не найден", {
        type: "survey",
        action: "get_single_failed",
        status: "survey_not_found",
        user_login: login,
        survey_id: surveyId,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Опрос не найден",
      });
    }

    const executionTime = Date.now() - startTime;

    logger.info("Опрос успешно получен", {
      type: "survey",
      action: "get_single_success",
      user_login: login,
      survey_id: surveyId,
      survey_found: true,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      survey: JSON.parse(results[0].survey),
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;

    if (error.code === "ER_NO_SUCH_TABLE") {
      logger.warn("Таблица пользователя не найдена при получении опроса", {
        type: "survey",
        action: "get_single_failed",
        status: "table_not_found",
        user_login: login,
        survey_id: surveyId,
        error_code: error.code,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Пользователь не найден или у вас нет опросов",
      });
    }

    logger.error("Ошибка получения опроса", {
      type: "survey",
      action: "get_single_error",
      user_login: login,
      survey_id: surveyId,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка получения опроса",
    });
  }
});

module.exports = router;
