// server/setupDirectories.js
const fs = require("fs").promises;
const path = require("path");

async function createUploadDirectories() {
  const baseDir = path.join(__dirname, "uploads");
  const directories = [
    baseDir,
    path.join(baseDir, "originals"),
    path.join(baseDir, "thumbnails"),
    path.join(baseDir, "temp"),
  ];

  console.log("📁 Создание структуры директорий для загрузок...");

  for (const dir of directories) {
    try {
      await fs.access(dir);
      console.log(`   ✅ ${path.relative(__dirname, dir)} уже существует`);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`   📁 Создана ${path.relative(__dirname, dir)}`);
    }
  }

  // Создаем .gitignore в uploads
  const gitignorePath = path.join(baseDir, ".gitignore");
  const gitignoreContent = `# Игнорировать все файлы в этой директории
*
!.gitignore
`;

  await fs.writeFile(gitignorePath, gitignoreContent);
  console.log("   📄 Создан .gitignore в uploads/");

  console.log("✅ Структура директорий готова");
}

// Запуск при прямом вызове
if (require.main === module) {
  createUploadDirectories().catch(console.error);
}

module.exports = { createUploadDirectories };
