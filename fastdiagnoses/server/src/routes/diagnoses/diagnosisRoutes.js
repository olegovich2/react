const express = require("express");
const router = express.Router();

// Импорты
const { ValidationError } = require("../../utils/validators");
const { query } = require("../../services/databaseService");
const logger = require("../../services/LoggerService");

// Поиск диагнозов
router.post("/search", async (req, res) => {
  const startTime = Date.now();
  const titles = req.body.titles;

  try {
    logger.info("Начало поиска диагнозов", {
      type: "diagnosis",
      action: "search_start",
      titles_count: titles?.length || 0,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      logger.warn("Нет данных для поиска диагнозов", {
        type: "diagnosis",
        action: "search_failed",
        status: "missing_titles",
        titles_count: 0,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Нет данных для поиска",
      });
    }

    // Проверяем длину массива (защита от слишком больших запросов)
    if (titles.length > 50) {
      logger.warn("Слишком много диагнозов для поиска", {
        type: "diagnosis",
        action: "search_failed",
        status: "too_many_titles",
        titles_count: titles.length,
        max_allowed: 50,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Слишком много диагнозов для поиска (максимум 50)",
      });
    }

    const validatedTitles = titles.map((title) => {
      if (typeof title !== "string" || title.length > 100) {
        throw new ValidationError("Некорректный диагноз для поиска", "titles");
      }
      return title.trim();
    });

    // Логируем валидированные диагнозы
    logger.info("Диагнозы валидированы для поиска", {
      type: "diagnosis",
      action: "titles_validated",
      titles_count: validatedTitles.length,
      sample_titles: validatedTitles.slice(0, 5), // Логируем только первые 5 для примера
      timestamp: new Date().toISOString(),
    });

    const placeholders = validatedTitles.map(() => "?").join(",");
    const sql = `SELECT * FROM alldiagnoses WHERE nameOfDisease IN (${placeholders})`;

    const results = await query(sql, validatedTitles);

    const diagnoses = [];
    const diagnosticsSet = new Set();
    const treatmentsSet = new Set();

    results.forEach((row) => {
      diagnoses.push(row.nameofDiseaseRu);

      if (row.diagnostics) {
        row.diagnostics.split(",").forEach((d) => {
          const trimmed = d.trim();
          if (trimmed) diagnosticsSet.add(trimmed);
        });
      }

      if (row.treatment) {
        row.treatment.split(",").forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) treatmentsSet.add(trimmed);
        });
      }
    });

    // Статистика найденных результатов
    const uniqueDiagnoses = [...new Set(diagnoses)];
    const diagnosticsCount = diagnosticsSet.size;
    const treatmentsCount = treatmentsSet.size;

    const executionTime = Date.now() - startTime;

    logger.info("Поиск диагнозов завершен успешно", {
      type: "diagnosis",
      action: "search_success",
      requested_titles_count: validatedTitles.length,
      found_diagnoses_count: results.length,
      unique_diagnoses_found: uniqueDiagnoses.length,
      diagnostics_found_count: diagnosticsCount,
      treatments_found_count: treatmentsCount,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      titles: uniqueDiagnoses,
      diagnostic: Array.from(diagnosticsSet),
      treatment: Array.from(treatmentsSet),
      stats: {
        requestedCount: validatedTitles.length,
        foundCount: results.length,
        uniqueDiagnoses: uniqueDiagnoses.length,
        diagnosticsCount: diagnosticsCount,
        treatmentsCount: treatmentsCount,
        executionTimeMs: executionTime,
      },
    });
  } catch (error) {
    logger.error("Ошибка поиска диагнозов", {
      type: "diagnosis",
      action: "search_error",
      titles_count: titles?.length || 0,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка поиска диагнозов",
    });
  }
});

module.exports = router;
