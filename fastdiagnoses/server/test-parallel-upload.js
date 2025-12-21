const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const API_URL = "http://localhost:5000/api/images/upload";
const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dpbiI6Im9sZWdvdmljaDIiLCJpYXQiOjE3NjYzMDQ3NTAsImV4cCI6MTc2NjMxMTk1MH0.c5hmJi0hvs_W3M8Z48WUv_3wL4DoJjcE3IXdO7rXsKc"; // Получи через вход
const IMAGE_PATH =
  "./UploadIMG/olegovich2/originals/d10d26a8-84f7-4905-9984-bccdc8813099_zima_noch_gory_79420_1920x1200.jpg"; // Путь к тестовому изображению

async function uploadImage(imageIndex) {
  const form = new FormData();
  form.append("image", fs.createReadStream(IMAGE_PATH));
  form.append("filename", `test-image-${imageIndex}.jpg`);
  form.append("comment", `Тестовая загрузка #${imageIndex}`);

  const startTime = Date.now();

  try {
    const response = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Изображение ${imageIndex} загружено за ${duration}ms`);
    return duration;
  } catch (error) {
    console.error(`❌ Ошибка загрузки ${imageIndex}:`, error.message);
    return 0;
  }
}

async function testParallelUploads(count = 3) {
  console.log(`🚀 Начинаем тест параллельной загрузки ${count} изображений...`);

  const startTime = Date.now();
  const promises = [];

  // Запускаем все загрузки одновременно
  for (let i = 1; i <= count; i++) {
    promises.push(uploadImage(i));
  }

  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  console.log("\n📊 Результаты:");
  console.log(`Общее время: ${totalTime}ms`);
  console.log(
    `Среднее время на изображение: ${(totalTime / count).toFixed(0)}ms`
  );
  console.log(`Максимальное время: ${Math.max(...results)}ms`);
  console.log(`Минимальное время: ${Math.min(...results)}ms`);

  // Если worker'ы работают параллельно, общее время должно быть
  // примерно равно самому долгому изображению, а не сумме всех
  const expectedSerial = results.reduce((a, b) => a + b, 0);
  console.log(
    `\n⚡ Эффективность параллелизации: ${(
      ((expectedSerial - totalTime) / expectedSerial) *
      100
    ).toFixed(1)}%`
  );
}

// Запуск теста
testParallelUploads(3).catch(console.error);
