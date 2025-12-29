// src/routes/data/dataRoutes.js
const express = require("express");
const router = express.Router();

// Импорты
const { authenticateToken } = require("../../middleware/auth");
const { query } = require("../../services/databaseService");
const { deleteImageFromDisk } = require("../../utils/fileSystem");

// Удаление записи (опроса или изображения)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Некорректный ID",
      });
    }

    const fileInfo = await query(
      `SELECT file_uuid, type FROM \`${login}\` WHERE id = ?`,
      [id]
    );

    if (fileInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Запись не найдена",
      });
    }

    if (fileInfo[0].type === "image" && fileInfo[0].file_uuid) {
      await deleteImageFromDisk(fileInfo[0].file_uuid, login);
    }

    const result = await query(`DELETE FROM \`${login}\` WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Запись не найдена",
      });
    }

    res.json({
      success: true,
      message: "Запись успешно удалена",
    });
  } catch (error) {
    console.error("Ошибка удаления записи:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка удаления записи",
    });
  }
});

module.exports = router;
