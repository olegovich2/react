const { parentPort, workerData } = require("worker_threads");
const sharp = require("sharp");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs").promises;

// Получаем ID воркера из данных или генерируем
const workerId = workerData?.workerId || Math.floor(Math.random() * 1000);
console.log(`🔄 Image Worker #${workerId} запущен (PID: ${process.pid})`);

parentPort.on("message", async (task) => {
  console.log(
    `📥 Worker #${workerId} получил задачу: ${task.fileUuid || "unknown"}`
  );

  try {
    const { buffer, originalFilename, userDir, fileUuid } = task;

    // Проверка обязательных данных
    if (!buffer || !originalFilename || !userDir || !fileUuid) {
      throw new Error("Неполные данные задачи");
    }

    // Генерируем имена файлов
    const extension = path.extname(originalFilename) || ".jpg";
    const baseName = path.basename(originalFilename, extension);
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, "_");
    const filename = `${fileUuid}_${safeBaseName}${extension}`;

    const originalsDir = path.join(userDir, "originals");
    const thumbnailsDir = path.join(userDir, "thumbnails");

    // Создаем директории если нет
    await fs.mkdir(originalsDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // 1. Сохраняем оригинал
    const originalPath = path.join(originalsDir, filename);
    const saveOriginalPromise = fs.writeFile(originalPath, buffer);

    // 2. Создаем превью
    let thumbnailBuffer;
    try {
      thumbnailBuffer = await sharp(buffer)
        .resize(300, 300, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (sharpError) {
      console.warn(
        `⚠️ Worker #${workerId}: Не удалось создать превью для ${fileUuid}:`,
        sharpError.message
      );
      // Используем оригинал как превью
      thumbnailBuffer = buffer;
    }

    const thumbnailPath = path.join(thumbnailsDir, filename);
    const saveThumbnailPromise = fs.writeFile(thumbnailPath, thumbnailBuffer);

    // 3. Получаем метаданные
    let metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch (metadataError) {
      console.warn(
        `⚠️ Worker #${workerId}: Не удалось получить метаданные для ${fileUuid}`
      );
      metadata = { width: 0, height: 0, format: "unknown" };
    }

    // Ждем сохранения файлов
    await Promise.all([saveOriginalPromise, saveThumbnailPromise]);

    // Получаем размер файла
    const fileStats = await fs.stat(originalPath);

    console.log(
      `✅ Worker #${workerId} обработал ${filename} (${Math.round(
        fileStats.size / 1024
      )}KB)`
    );

    // Отправляем результат обратно
    parentPort.postMessage({
      success: true,
      fileUuid,
      filename,
      originalFilename,
      fileSize: fileStats.size,
      width: metadata.width || 0,
      height: metadata.height || 0,
      mimeType: `image/${metadata.format || "jpeg"}`,
      fileHash: crypto.createHash("sha256").update(buffer).digest("hex"),
      workerId: workerId,
      processingTime: Date.now() - task.timestamp,
    });
  } catch (error) {
    console.error(`❌ Worker #${workerId} ошибка:`, error.message);

    // Fallback: пробуем сохранить хотя бы оригинал
    try {
      if (
        task.buffer &&
        task.fileUuid &&
        task.userDir &&
        task.originalFilename
      ) {
        const originalsDir = path.join(task.userDir, "originals");
        await fs.mkdir(originalsDir, { recursive: true });

        const extension = path.extname(task.originalFilename) || ".jpg";
        const baseName = path.basename(task.originalFilename, extension);
        const safeBaseName = baseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, "_");
        const filename = `${task.fileUuid}_${safeBaseName}${extension}`;

        const fallbackPath = path.join(originalsDir, filename);
        await fs.writeFile(fallbackPath, task.buffer);

        console.log(
          `⚠️ Worker #${workerId}: Использован fallback для ${task.fileUuid}`
        );

        parentPort.postMessage({
          success: true,
          fileUuid: task.fileUuid,
          filename,
          originalFilename: task.originalFilename,
          fileSize: task.buffer.length,
          width: 0,
          height: 0,
          mimeType: "image/jpeg",
          fileHash: crypto
            .createHash("sha256")
            .update(task.buffer)
            .digest("hex"),
          fallback: true,
          workerId: workerId,
          error: error.message,
        });
        return;
      }
    } catch (fallbackError) {
      console.error(
        `❌ Worker #${workerId}: Fallback тоже не удался:`,
        fallbackError.message
      );
    }

    parentPort.postMessage({
      success: false,
      error: error.message,
      fileUuid: task.fileUuid,
      workerId: workerId,
    });
  }
});

// Обработка выхода
process.on("SIGTERM", () => {
  console.log(`🛑 Worker #${workerId} получает SIGTERM, завершаюсь...`);
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(`🛑 Worker #${workerId} получает SIGINT, завершаюсь...`);
  process.exit(0);
});
