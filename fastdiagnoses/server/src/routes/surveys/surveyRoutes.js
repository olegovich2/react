// src/routes/surveys/surveyRoutes.js
const express = require("express");
const router = express.Router();

// Импорты
const { authenticateToken } = require("../../middleware/auth");
const { validateSurvey } = require("../../utils/validators");
const userTableService = require("../../services/userTableService");
const { query, getConnection } = require("../../services/databaseService");

// Сохранение опроса
router.post("/save", authenticateToken, async (req, res) => {
  try {
    const survey = validateSurvey(req.body.survey);
    const login = req.user.login;

    if (!survey) {
      return res.status(400).json({
        success: false,
        message: "Данные опроса отсутствуют",
      });
    }

    const tableExists = await userTableService.tableExists(login);
    if (!tableExists) {
      await userTableService.createUserTable(login);
    }

    await query(
      `INSERT INTO \`${login}\` (survey, type) VALUES (?, 'survey')`,
      [JSON.stringify(survey)]
    );

    res.json({
      success: true,
      message: "Опрос сохранен успешно",
    });
  } catch (error) {
    console.error("Save survey error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка сохранения опроса",
    });
  }
});

// Получение опросов с пагинацией
router.post("/paginated", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;
    const { page = 1, limit = 5 } = req.body;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Некорректный номер страницы",
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        message: "Некорректный лимит (максимум 50 записей на страницу)",
      });
    }

    const offset = (pageNum - 1) * limitNum;

    const tableExists = await userTableService.tableExists(login);

    if (!tableExists) {
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
      } catch {
        return {
          id: row.id,
          date: row.created_at,
          survey: { date: row.created_at },
        };
      }
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
    console.error("Ошибка получения опросов с пагинацией:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
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

    res.status(500).json({
      success: false,
      message: "Ошибка получения опросов",
    });
  }
});

// Получение конкретного опроса
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Некорректный ID",
      });
    }

    const sql = `SELECT survey FROM \`${login}\` WHERE id = ? AND survey IS NOT NULL`;
    const results = await query(sql, [parseInt(id)]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Опрос не найден",
      });
    }

    res.json({
      success: true,
      survey: JSON.parse(results[0].survey),
    });
  } catch (error) {
    console.error("Ошибка получения опроса:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден или у вас нет опросов",
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка получения опроса",
    });
  }
});

module.exports = router;
