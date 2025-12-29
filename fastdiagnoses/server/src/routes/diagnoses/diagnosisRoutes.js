// src/routes/diagnoses/diagnosisRoutes.js
const express = require("express");
const router = express.Router();

// Импорты
const { ValidationError } = require("../../utils/validators");
const { query } = require("../../services/databaseService");

// Поиск диагнозов
router.post("/search", async (req, res) => {
  try {
    const { titles } = req.body;

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Нет данных для поиска",
      });
    }

    const validatedTitles = titles.map((title) => {
      if (typeof title !== "string" || title.length > 100) {
        throw new ValidationError("Некорректный диагноз для поиска", "titles");
      }
      return title.trim();
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

    res.json({
      success: true,
      titles: [...new Set(diagnoses)],
      diagnostic: Array.from(diagnosticsSet),
      treatment: Array.from(treatmentsSet),
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Search diagnoses error:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка поиска диагнозов",
    });
  }
});

module.exports = router;
