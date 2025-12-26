const bcrypt = require("bcrypt");

async function checkHash() {
  const currentHash =
    "$2a$12$LkiNvXeYDpmO7AQz4H7/8uSgW9rJKlMn0PqRsTbVwXyZaBcDeFgh6";
  const secretWord = "банан";

  console.log("🔍 Проверяем хэш...");
  console.log("Хэш в БД:", currentHash);
  console.log("Слово для проверки:", secretWord);

  try {
    const isMatch = await bcrypt.compare(secretWord, currentHash);
    console.log("✅ Результат сравнения:", isMatch);

    if (!isMatch) {
      console.log("\n❌ Слово 'банан' НЕ совпадает с хэшем в БД!");
      console.log("🤔 Возможные варианты:");
      console.log("1. В БД лежит хэш от другого слова");
      console.log("2. Была другая соль при создании хэша");
      console.log("3. Слово содержит лишние пробелы или другой регистр");

      // Проверим разные варианты
      const testVariants = [
        "банан",
        "Банан",
        "БАНАН",
        " банан",
        "банан ",
        " банан ",
        "банан\n",
        "Банан",
        "ба нан",
        "b a n a n",
        "banan",
      ];

      console.log("\n🔍 Проверяем разные варианты:");
      for (const variant of testVariants) {
        const match = await bcrypt.compare(variant, currentHash);
        if (match) {
          console.log(`✅ НАЙДЕНО СОВПАДЕНИЕ: "${variant}"`);
          return;
        }
      }
      console.log("❌ Ни один вариант не подошел");

      // Создаем новый правильный хэш
      console.log("\n🔄 Создаем новый правильный хэш для 'банан':");
      const newHash = await bcrypt.hash("банан", 12);
      console.log("Новый хэш:", newHash);
      console.log("\n📝 Команда для БД:");
      console.log(
        `UPDATE usersdata SET secret_word = '${newHash}' WHERE email = '19922403wawa@gmail.com' AND logic = 'true';`
      );
    }
  } catch (error) {
    console.error("❌ Ошибка:", error.message);
  }
}

checkHash();
