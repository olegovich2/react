// src/routes/index.js
const express = require("express");
const router = express.Router();

// Импортируем роуты
const authRoutes = require("./auth/authRoutes");
const passwordResetRoutes = require("./auth/passwordResetRoutes");
const surveyRoutes = require("./surveys/surveyRoutes");
const imageRoutes = require("./images/imageRoutes");
const diagnosisRoutes = require("./diagnoses/diagnosisRoutes");
const userRoutes = require("./user/userRoutes");
const dataRoutes = require("./data/dataRoutes");

// Health check (оставим здесь)
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Сервер работает",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    features: ["file-system-storage", "uuid-filenames", "modular-routes"],
  });
});

// Регистрируем роуты
router.use("/auth", authRoutes);
router.use("/auth", passwordResetRoutes);
router.use("/surveys", surveyRoutes);
router.use("/images", imageRoutes);
router.use("/diagnoses", diagnosisRoutes);
router.use("/settings", userRoutes);
router.use("/data", dataRoutes);

module.exports = router;
