const fs = require("fs").promises;
const path = require("path");
const config = require("../config");

// Обеспечиваем существование директорий
async function ensureUploadDirs() {
  try {
    await fs.access(config.UPLOAD_DIR);
  } catch {
    await fs.mkdir(config.UPLOAD_DIR, { recursive: true });
  }
}

// Получаем пути директорий пользователя
async function getUserUploadDirs(login) {
  const userDir = path.join(config.UPLOAD_DIR, login);
  const originalsDir = path.join(userDir, "originals");
  const thumbnailsDir = path.join(userDir, "thumbnails");

  return { userDir, originalsDir, thumbnailsDir };
}

// Создаем директории пользователя
async function ensureUserUploadDirs(login) {
  const { originalsDir, thumbnailsDir } = await getUserUploadDirs(login);

  await fs.mkdir(originalsDir, { recursive: true });
  await fs.mkdir(thumbnailsDir, { recursive: true });

  return { originalsDir, thumbnailsDir };
}

// Удаление изображения с диска
async function deleteImageFromDisk(fileUuid, login) {
  try {
    const { originalsDir, thumbnailsDir } = await getUserUploadDirs(login);

    // Ищем файл по UUID
    const files = await fs.readdir(originalsDir);
    const fileToDelete = files.find((f) => f.includes(fileUuid));

    if (fileToDelete) {
      await fs.unlink(path.join(originalsDir, fileToDelete));

      // Пытаемся удалить превью
      try {
        await fs.unlink(path.join(thumbnailsDir, fileToDelete));
      } catch (error) {
        // Если превью нет - не критично
        console.warn("Не удалось удалить превью:", error.message);
      }

      return true;
    }
    return false;
  } catch (error) {
    console.error("Ошибка удаления файла:", error);
    return false;
  }
}

module.exports = {
  ensureUploadDirs,
  getUserUploadDirs,
  ensureUserUploadDirs,
  deleteImageFromDisk,
};
